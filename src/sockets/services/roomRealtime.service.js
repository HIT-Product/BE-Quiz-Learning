import roomSessionService from './roomSession.service.js'
import { redisClient } from '../../configs/index.js'
import { randomUUID } from 'node:crypto'
import { StatusCodes } from 'http-status-codes'
import { pomodoroQueue } from '../../queues/index.js'
import { ApiError, logger } from '../../utils/index.js'
import { socketError } from '../utils/socketHandler.js'
import { studyRoomModel, roomParticipantModel, roomMessageModel, pomodoroSessionModel } from '../../models/index.js'
import { roomMediaService } from '../../services/client/index.js'
import { STUDY_ACTIVITY_SOURCE, recordStudyActivity } from '../../services/client/studyActivity.service.js'
import { serializePomodoroState } from '../contracts/pomodoro.contract.js'
import {
  ROOM_REDIS_KEY,
  ROOM_REDIS_TTL_SECONDS,
  POMODORO_PHASE,
  POMODORO_STATUS,
  ROOM_ROLE,
  ROOM_STATUS,
  ROOM_LIMITS,
  ROOM_CLOSE_LOCK_SECONDS
} from '../../constants/index.js'

const GETDEL_LUA = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value`

const getAndDelete = (key) => redisClient.eval(GETDEL_LUA, 1, key)
const pomodoroJobId = (roomId, cycle, phase) => `pomo-${roomId}-${cycle}-${phase}`

const markParticipantLeft = async (roomId, userId) => {
  await roomParticipantModel.updateOne({ roomId, userId, leftAt: null }, { $set: { leftAt: new Date() } })
}

const markRoomBecameEmpty = (roomId) =>
  studyRoomModel.updateOne({ _id: roomId, status: ROOM_STATUS.OPEN }, { $set: { emptySince: new Date() } })

const markRoomOccupied = (roomId) =>
  studyRoomModel.updateOne({ _id: roomId, status: ROOM_STATUS.OPEN }, { $set: { emptySince: null } })

const markStudyStartIfWorking = async (roomId, userId) => {
  const pomo = await redisClient.hgetall(ROOM_REDIS_KEY.POMODORO(roomId))
  if (pomo?.status === POMODORO_STATUS.RUNNING && pomo?.phase === POMODORO_PHASE.WORK) {
    await redisClient.set(ROOM_REDIS_KEY.STUDY_MARK(roomId, userId), Date.now(), 'EX', ROOM_REDIS_TTL_SECONDS)
  }
}

const settleStudyTime = async (roomId, userId) => {
  const key = ROOM_REDIS_KEY.STUDY_MARK(roomId, userId)
  const startedAt = await getAndDelete(key)
  if (!startedAt) return 0

  const rawDelta = Math.floor((Date.now() - Number(startedAt)) / 1000)
  const deltaSec = Math.min(Math.max(0, rawDelta), ROOM_LIMITS.WORK_MAX * 60)
  if (deltaSec > 0) {
    await redisClient.zincrby(ROOM_REDIS_KEY.LEADERBOARD(roomId), deltaSec, String(userId))
    await recordStudyActivity(userId, STUDY_ACTIVITY_SOURCE.STUDY_ROOM)
  }
  return deltaSec
}

const settleAllStudyTime = async (roomId) => {
  const userIds = await roomSessionService.listPresenceUserIds(roomId)
  await Promise.all(userIds.map((uid) => settleStudyTime(roomId, uid)))
}

const flushLeaderboardToDB = async (roomId) => {
  const entries = await redisClient.zrange(ROOM_REDIS_KEY.LEADERBOARD(roomId), 0, -1, 'WITHSCORES')
  const ops = []

  for (let i = 0; i < entries.length; i += 2) {
    ops.push({
      updateOne: {
        filter: { roomId, userId: entries[i] },
        update: { $inc: { studySeconds: Number(entries[i + 1]) } }
      }
    })
  }

  if (ops.length) await roomParticipantModel.bulkWrite(ops)
  await redisClient.del(ROOM_REDIS_KEY.LEADERBOARD(roomId))
}

const buildLeaderboard = async (roomId) => {
  const [redisEntries, persisted, activeUserIds] = await Promise.all([
    redisClient.zrange(ROOM_REDIS_KEY.LEADERBOARD(roomId), 0, -1, 'WITHSCORES'),
    roomParticipantModel.find({ roomId, bannedAt: null }).select('userId studySeconds').lean(),
    roomSessionService.listPresenceUserIds(roomId)
  ])
  const activeStartedAt = activeUserIds.length
    ? await redisClient.mget(activeUserIds.map((userId) => ROOM_REDIS_KEY.STUDY_MARK(roomId, userId)))
    : []

  const totals = new Map()
  for (const participant of persisted) {
    totals.set(String(participant.userId), Number(participant.studySeconds || 0))
  }

  for (let i = 0; i < redisEntries.length; i += 2) {
    const userId = String(redisEntries[i])
    totals.set(userId, (totals.get(userId) || 0) + Number(redisEntries[i + 1]))
  }

  const now = Date.now()
  for (let i = 0; i < activeUserIds.length; i += 1) {
    const startedAt = Number(activeStartedAt[i])
    if (!Number.isFinite(startedAt) || startedAt <= 0) continue
    const activeSeconds = Math.min(Math.max(0, Math.floor((now - startedAt) / 1000)), ROOM_LIMITS.WORK_MAX * 60)
    const userId = String(activeUserIds[i])
    totals.set(userId, (totals.get(userId) || 0) + activeSeconds)
  }

  return [...totals.entries()]
    .map(([userId, studySeconds]) => ({ userId, studySeconds }))
    .sort((a, b) => b.studySeconds - a.studySeconds)
    .slice(0, 50)
}

const buildRoomState = async (roomId, room) => {
  const [pomo, leaderboard, onlineIds, recentMessages] = await Promise.all([
    redisClient.hgetall(ROOM_REDIS_KEY.POMODORO(roomId)),
    buildLeaderboard(roomId),
    roomSessionService.listPresenceUserIds(roomId),
    roomMessageModel
      .find({ roomId, deletedAt: null })
      .populate('senderId', 'displayName avatar')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
  ])

  const onlineUsers = onlineIds.length
    ? await roomParticipantModel
        .find({ roomId, userId: { $in: onlineIds }, bannedAt: null })
        .populate('userId', 'displayName avatar avatarUrl')
        .select('userId role')
        .lean()
    : []

  const now = Date.now()
  const pomodoro = serializePomodoroState(pomo, now)

  return {
    room,
    onlineIds,
    onlineUsers,
    pomodoro,
    leaderboard,
    recentMessages: recentMessages.reverse(),
    serverNow: now
  }
}

const transferHostIfNeeded = async (nsp, roomId, leftUserId) => {
  const room = await studyRoomModel.findOne({
    _id: roomId,
    hostId: leftUserId,
    status: ROOM_STATUS.OPEN
  })
  if (!room) return null

  const onlineIds = await roomSessionService.listPresenceUserIds(roomId)
  if (!onlineIds.length) return null

  const next = await roomParticipantModel
    .findOne({
      roomId,
      userId: { $in: onlineIds },
      leftAt: null,
      kickedAt: null,
      bannedAt: null
    })
    .sort({ joinedAt: 1 })
  if (!next) return null

  const updatedRoom = await studyRoomModel.findOneAndUpdate(
    { _id: roomId, hostId: leftUserId, status: ROOM_STATUS.OPEN },
    { $set: { hostId: next.userId } },
    { new: true }
  )
  if (!updatedRoom) return null

  await roomParticipantModel.updateMany(
    { roomId, role: ROOM_ROLE.HOST, _id: { $ne: next._id } },
    { $set: { role: ROOM_ROLE.MEMBER } }
  )
  await roomParticipantModel.updateOne({ _id: next._id }, { $set: { role: ROOM_ROLE.HOST } })

  const payload = { roomId: String(roomId), newHostId: String(next.userId) }
  nsp.to(`room:${roomId}`).emit('room:host-changed', payload)
  return payload
}

const closeError = (statusCode, code, message) => Object.assign(new ApiError(statusCode, message), { code })

const clearRealtimeRoomArtifacts = async (roomId, leases) => {
  const studyMarkKeys = await redisClient.keys(`room:${roomId}:study:*`)
  const redisKeys = [
    ROOM_REDIS_KEY.PRESENCE(roomId),
    ROOM_REDIS_KEY.POMODORO(roomId),
    ROOM_REDIS_KEY.LEADERBOARD(roomId),
    ...studyMarkKeys
  ]

  await Promise.allSettled(
    leases.flatMap((lease) => [
      roomSessionService.releaseDevice({
        userId: lease.userId,
        socketId: lease.socketId,
        generation: lease.generation
      }),
      roomSessionService.removePresence({
        roomId,
        userId: lease.userId,
        socketId: lease.socketId,
        generation: lease.generation
      })
    ])
  )
  if (redisKeys.length) await redisClient.del(...redisKeys)
}

const closeRoom = async (nsp, roomId, requesterId) => {
  const lockToken = randomUUID()
  const lockKey = ROOM_REDIS_KEY.CLOSE_LOCK(roomId)
  const locked = await redisClient.set(lockKey, lockToken, 'EX', ROOM_CLOSE_LOCK_SECONDS, 'NX')
  if (locked !== 'OK') {
    const room = await studyRoomModel.findById(roomId)
    if (!room) throw closeError(StatusCodes.NOT_FOUND, 'NOT_FOUND', 'Phong hoc khong ton tai.')
    if (requesterId && String(room.hostId) !== String(requesterId)) {
      throw closeError(StatusCodes.FORBIDDEN, 'NOT_HOST', 'Chi chu phong moi duoc dong phong.')
    }
    if (room.status === ROOM_STATUS.CLOSED) return room
    throw closeError(StatusCodes.CONFLICT, 'ROOM_CLOSING', 'Phong hoc dang duoc dong. Vui long thu lai sau.')
  }

  try {
    const existingRoom = await studyRoomModel.findById(roomId)
    if (!existingRoom) throw closeError(StatusCodes.NOT_FOUND, 'NOT_FOUND', 'Phong hoc khong ton tai.')
    if (requesterId && String(existingRoom.hostId) !== String(requesterId)) {
      throw closeError(StatusCodes.FORBIDDEN, 'NOT_HOST', 'Chi chu phong moi duoc dong phong.')
    }
    if (existingRoom.status === ROOM_STATUS.CLOSED) return existingRoom

    const room = await studyRoomModel.findOneAndUpdate(
      {
        _id: roomId,
        status: { $in: [ROOM_STATUS.OPEN, ROOM_STATUS.CLOSING] },
        ...(requesterId ? { hostId: requesterId } : {})
      },
      { $set: { status: ROOM_STATUS.CLOSING } },
      { new: true }
    )

    if (!room) {
      const currentRoom = await studyRoomModel.findById(roomId)
      if (currentRoom?.status === ROOM_STATUS.CLOSED) return currentRoom
      throw closeError(StatusCodes.CONFLICT, 'ROOM_CLOSING', 'Phong hoc dang duoc dong. Vui long thu lai sau.')
    }

    const pomo = await redisClient.hgetall(ROOM_REDIS_KEY.POMODORO(roomId))
    if (pomo?.cycle && pomo?.phase) {
      const job = await pomodoroQueue.getJob(pomodoroJobId(roomId, pomo.cycle, pomo.phase))
      if (job) await job.remove()
    }

    await settleAllStudyTime(roomId)
    await flushLeaderboardToDB(roomId)
    await pomodoroSessionModel.updateMany({ roomId, endedAt: null }, { $set: { endedAt: new Date() } })
    const closedAt = new Date()
    await roomParticipantModel.updateMany({ roomId, leftAt: null }, { $set: { leftAt: closedAt, joinExpiresAt: null } })
    try {
      await roomMediaService.deleteRoom(roomId)
    } catch (error) {
      // Media cleanup is best-effort. A LiveKit outage must not prevent the
      // persisted room lifecycle from reaching CLOSED.
      logger.warn(`LiveKit room cleanup failed during close: room=${roomId} error=${error.message}`)
    }

    const leases = await roomSessionService.listPresenceEntries(roomId)
    const closedRoom = await studyRoomModel.findByIdAndUpdate(
      roomId,
      { $set: { status: ROOM_STATUS.CLOSED, closedAt, emptySince: null } },
      { new: true }
    )

    nsp.to(`room:${roomId}`).emit('room:closed', { roomId })
    nsp.in(`room:${roomId}`).socketsLeave(`room:${roomId}`)

    await clearRealtimeRoomArtifacts(roomId, leases)
    return closedRoom
  } finally {
    const unlockLua = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `
    await redisClient.eval(unlockLua, 1, lockKey, lockToken)
  }
}

const closeIdleRooms = async (nsp) => {
  const idleBefore = new Date(Date.now() - ROOM_LIMITS.IDLE_CLOSE_MINUTES * 60 * 1000)
  const idleRooms = await studyRoomModel
    .find({ status: ROOM_STATUS.OPEN, updatedAt: { $lt: idleBefore } })
    .select('_id')
    .lean()

  const stats = { scanned: idleRooms.length, closed: 0, recovered: 0, skipped: 0, failed: 0 }

  for (const room of idleRooms) {
    const roomId = String(room._id)
    try {
      const online = await roomSessionService.countPresence(roomId)
      if (online > 0) {
        stats.skipped += 1
        continue
      }

      const socketsInRoom = await nsp.in(`room:${roomId}`).fetchSockets()
      if (socketsInRoom.length > 0) {
        stats.skipped += 1
        continue
      }

      const closed = await closeRoom(nsp, roomId, null)
      if (closed) stats.closed += 1
    } catch (error) {
      stats.failed += 1
      logger.error(`Close idle room failed: roomId=${roomId} error=${error.message}`)
    }
  }

  return stats
}

const assertRoomHost = async (roomId, hostId) => {
  const room = await studyRoomModel.findById(roomId)
  if (!room?.hostId.equals(hostId)) throw socketError('NOT_HOST', 'Chi chu phong moi duoc dieu khien phong.')
  return room
}

const muteAll = async (nsp, roomId, hostId) => {
  const room = await assertRoomHost(roomId, hostId)
  await roomMediaService.muteAllMicrophones(roomId, hostId)
  const payload = { roomId, by: String(hostId), at: Date.now() }
  nsp.to(`room:${roomId}`).emit('room:mute-all', payload)
  return { ...payload, micLocked: Boolean(room.settings?.micLocked) }
}

const setMicLock = async (nsp, roomId, hostId, micLocked) => {
  await assertRoomHost(roomId, hostId)
  const room = await studyRoomModel.findOneAndUpdate(
    { _id: roomId, status: ROOM_STATUS.OPEN },
    { $set: { 'settings.micLocked': Boolean(micLocked) } },
    { new: true }
  )
  if (!room) throw socketError('NOT_FOUND', 'Phong hoc khong ton tai hoac da dong.')

  const onlineIds = await roomSessionService.listPresenceUserIds(roomId)
  await Promise.allSettled(
    onlineIds
      .filter((userId) => String(userId) !== String(hostId))
      .map((userId) =>
        roomMediaService.updateMicrophonePermission({
          roomId,
          userId,
          allowMicrophone: !micLocked && room.settings.micAllowed !== false,
          allowCamera: room.settings.cameraAllowed !== false
        })
      )
  )

  if (micLocked) await roomMediaService.muteAllMicrophones(roomId, hostId)

  const payload = {
    roomId,
    micLocked: Boolean(room.settings.micLocked),
    by: String(hostId),
    at: Date.now()
  }
  nsp.to(`room:${roomId}`).emit('room:mic-lock-changed', payload)
  if (payload.micLocked) nsp.to(`room:${roomId}`).emit('room:mute-all', payload)
  return payload
}

const kick = async (nsp, roomId, hostId, targetUserId, { ban = false } = {}) => {
  const room = await assertRoomHost(roomId, hostId)
  if (String(hostId) === String(targetUserId)) {
    throw socketError('INVALID_PAYLOAD', 'Khong the tu da chinh minh.')
  }

  const participant = await roomParticipantModel.findOne({
    roomId,
    userId: targetUserId,
    leftAt: null,
    bannedAt: null
  })
  if (!participant) throw socketError('NOT_FOUND', 'Thanh vien khong con trong phong.')

  await settleStudyTime(roomId, targetUserId)
  const now = new Date()
  participant.leftAt = now
  participant.kickedAt = now
  if (ban) participant.bannedAt = now
  await participant.save()

  await roomMediaService.removeParticipant(roomId, targetUserId)

  const active = await roomSessionService.getActiveDevice(targetUserId)
  if (active && String(active.roomId) === String(roomId)) {
    await roomSessionService.releaseDevice({
      userId: targetUserId,
      socketId: active.socketId,
      generation: active.generation
    })
    await roomSessionService.removePresence({
      roomId,
      userId: targetUserId,
      socketId: active.socketId,
      generation: active.generation
    })
    nsp.to(active.socketId).emit(ban ? 'room:banned' : 'room:kicked', { roomId })
    nsp.in(active.socketId).socketsLeave(`room:${roomId}`)
  }

  nsp.to(`room:${roomId}`).emit('room:member-left', { userId: String(targetUserId) })
  return { roomId, targetUserId: String(targetUserId), banned: ban, hostId: String(room.hostId) }
}

export default {
  markParticipantLeft,
  markRoomBecameEmpty,
  markRoomOccupied,
  markStudyStartIfWorking,
  settleStudyTime,
  settleAllStudyTime,
  flushLeaderboardToDB,
  buildLeaderboard,
  buildRoomState,
  transferHostIfNeeded,
  closeRoom,
  closeIdleRooms,
  muteAll,
  setMicLock,
  kick
}
