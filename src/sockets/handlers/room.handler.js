import Joi from 'joi'

import { ROOM_LIMITS } from '../../constants/index.js'
import { userModel } from '../../models/index.js'
import { roomMediaService, studyRoomService } from '../../services/client/index.js'
import { logger } from '../../utils/index.js'
import { roomRealtimeService, roomSessionService } from '../services/index.js'
import { safeHandler, socketError } from '../utils/socketHandler.js'

const roomIdSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required()
})

const targetSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required(),
  targetUserId: Joi.string().hex().length(24).required()
})

const micLockSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required(),
  micLocked: Joi.boolean().required()
})

const validate = (schema, payload) => {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true })
  if (error) throw socketError('INVALID_PAYLOAD', 'Du lieu phong hoc khong hop le.')
  return value
}

const finishLeave = async (nsp, socket, roomId, userId, { releaseDevice = true } = {}) => {
  const generation = socket.data.generation
  const socketId = socket.id

  if (releaseDevice) {
    await roomSessionService.releaseDevice({ userId, socketId, generation })
  }

  socket.leave(`room:${roomId}`)
  socket.data.roomId = null
  await roomRealtimeService.settleStudyTime(roomId, userId)
  await roomRealtimeService.markParticipantLeft(roomId, userId)

  const onlineCount = await roomSessionService.removePresence({
    roomId,
    userId,
    socketId,
    generation
  })

  if (onlineCount > 0) {
    nsp.to(`room:${roomId}`).emit('room:member-left', { userId: String(userId) })
    await roomRealtimeService.transferHostIfNeeded(nsp, roomId, userId)
  } else {
    await roomRealtimeService.markRoomBecameEmpty(roomId)
  }
}

const assertClaimAccepted = (claim) => {
  if (claim.status === 'OK') return

  const failures = {
    ACTIVE_OTHER_ROOM: ['ACTIVE_ROOM_CONFLICT', 'Bạn đang hoạt động trong một phòng học khác.'],
    SWITCH_REQUIRED: [
      'SWITCH_REQUIRED',
      'Phòng học này đang mở trên thiết bị khác. Hãy rời phiên cũ trước khi thử lại.'
    ],
    STALE_SWITCH: ['STALE_SWITCH', 'Yêu cầu chuyển thiết bị đã hết hạn. Vui lòng thử lại.'],
    ROOM_FULL: ['ROOM_FULL', 'Phòng học đã đủ thành viên.']
  }
  const [code, message] = failures[claim.status] || [
    'INTERNAL_ERROR',
    'Không thể giữ phiên phòng học. Vui lòng thử lại.'
  ]
  throw socketError(code, message)
}

const registerRoomHandlers = (nsp, socket) => {
  const userId = socket.user._id

  socket.on(
    'room:join',
    safeHandler(async (payload) => {
      const { roomId } = validate(roomIdSchema, payload)
      const room = await studyRoomService.findOpenRoom(roomId)
      await studyRoomService.assertActiveParticipant(roomId, userId)
      const profile = await userModel.findById(userId).select('displayName avatar avatarUrl').lean()

      const claim = await roomSessionService.claimJoin({
        roomId,
        userId,
        socketId: socket.id,
        sessionId: socket.user.sessionId,
        deviceId: socket.data.deviceId,
        maxParticipants: room.maxParticipants
      })
      assertClaimAccepted(claim)

      socket.data.generation = claim.generation
      const previous = claim.previousActive
      const tookOver = Boolean(previous?.socketId && previous.socketId !== socket.id)

      try {
        socket.join(`room:${roomId}`)
        socket.data.roomId = roomId
        socket.data.chatEnabled = room.settings.chatEnabled
        socket.data.profile = profile
        await roomRealtimeService.markRoomOccupied(roomId)
        await roomRealtimeService.markStudyStartIfWorking(roomId, userId)

        const snapshot = {
          ...(await roomRealtimeService.buildRoomState(roomId, room)),
          deviceGeneration: claim.generation,
          tookOver
        }

        if (tookOver) {
          nsp.to(previous.socketId).emit('room:session-taken-over', {
            roomId: String(roomId),
            newDeviceId: socket.data.deviceId,
            generation: claim.generation,
            message: 'Phòng học đã được chuyển sang phiên mới.'
          })
          nsp.in(previous.socketId).socketsLeave(`room:${roomId}`)
          await roomMediaService.removeParticipantForHandoff(roomId, userId)
        }

        if (!claim.previousPresenceRaw) {
          socket.to(`room:${roomId}`).emit('room:member-joined', { userId: String(userId) })
        }
        return snapshot
      } catch (error) {
        socket.leave(`room:${roomId}`)
        socket.data.roomId = null
        socket.data.generation = null
        await Promise.allSettled([
          roomSessionService.rollbackClaim({
            roomId,
            userId,
            socketId: socket.id,
            generation: claim.generation,
            previousActiveRaw: claim.previousActiveRaw,
            previousPresenceRaw: claim.previousPresenceRaw
          })
        ])
        try {
          if ((await roomSessionService.countPresence(roomId)) === 0) {
            await roomRealtimeService.markRoomBecameEmpty(roomId)
          }
        } catch (cleanupError) {
          logger.warn(`Join rollback cleanup failed: room=${roomId} user=${userId} error=${cleanupError.message}`)
        }
        throw error
      }
    })
  )

  socket.on(
    'room:leave',
    safeHandler(async (payload) => {
      const { roomId } = validate(roomIdSchema, payload)
      await roomSessionService.assertDeviceOwner({
        userId,
        roomId,
        socketId: socket.id,
        generation: socket.data.generation,
        deviceId: socket.data.deviceId
      })
      await finishLeave(nsp, socket, roomId, userId)
      return { roomId }
    })
  )

  socket.on(
    'leaderboard:get',
    safeHandler(async (payload) => {
      const { roomId } = validate(roomIdSchema, payload)
      await roomSessionService.assertDeviceOwner({
        userId,
        roomId,
        socketId: socket.id,
        generation: socket.data.generation,
        deviceId: socket.data.deviceId
      })
      return roomRealtimeService.buildLeaderboard(roomId)
    })
  )

  socket.on(
    'room:kick',
    safeHandler(async (payload) => {
      const { roomId, targetUserId } = validate(targetSchema, payload)
      return roomRealtimeService.kick(nsp, roomId, userId, targetUserId)
    })
  )

  socket.on(
    'room:ban',
    safeHandler(async (payload) => {
      const { roomId, targetUserId } = validate(targetSchema, payload)
      return roomRealtimeService.kick(nsp, roomId, userId, targetUserId, { ban: true })
    })
  )

  socket.on(
    'room:mute-all',
    safeHandler(async (payload) => {
      const { roomId } = validate(roomIdSchema, payload)
      return roomRealtimeService.muteAll(nsp, roomId, userId)
    })
  )

  socket.on(
    'room:set-mic-lock',
    safeHandler(async (payload) => {
      const { roomId, micLocked } = validate(micLockSchema, payload)
      return roomRealtimeService.setMicLock(nsp, roomId, userId, micLocked)
    })
  )

  socket.on(
    'room:close',
    safeHandler(async () => {
      throw socketError('FEATURE_NOT_READY', 'Tính năng realtime/media tạm thời chưa khả dụng trong lúc nâng cấp.')
    })
  )

  socket.on('disconnect', (reason) => {
    const roomId = socket.data.roomId
    if (!roomId) return

    setTimeout(async () => {
      try {
        const stillOwner = await roomSessionService.isDeviceOwner({
          userId,
          roomId,
          socketId: socket.id,
          generation: socket.data.generation,
          deviceId: socket.data.deviceId
        })
        if (!stillOwner) return
        await finishLeave(nsp, socket, roomId, userId)
        logger.info(`Disconnect grace cleanup: room=${roomId} user=${userId} reason=${reason}`)
      } catch (error) {
        logger.error(`Disconnect cleanup failed: room=${roomId} user=${userId} error=${error.message}`)
      }
    }, ROOM_LIMITS.DISCONNECT_GRACE_MS)
  })
}

export default registerRoomHandlers
