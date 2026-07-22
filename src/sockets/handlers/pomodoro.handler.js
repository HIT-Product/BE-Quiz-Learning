import Joi from 'joi'

import { pomodoroQueue } from '../../queues/index.js'
import { redisClient } from '../../configs/index.js'
import { studyRoomModel, pomodoroSessionModel } from '../../models/index.js'
import { roomRealtimeService, roomSessionService } from '../services/index.js'
import { serializePomodoroState } from '../contracts/pomodoro.contract.js'
import { safeHandler, socketError } from '../utils/socketHandler.js'
import {
  POMODORO_JOB_NAME,
  ROOM_REDIS_KEY,
  ROOM_REDIS_TTL_SECONDS,
  POMODORO_PHASE,
  POMODORO_STATUS
} from '../../constants/index.js'

const roomActionSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required()
})

const assertHost = async (roomId, userId) => {
  const room = await studyRoomModel.findById(roomId).select('hostId pomodoroWorkMin pomodoroBreakMin').lean()
  if (!room) throw socketError('ROOM_CLOSED', 'Phong khong ton tai hoac da dong.')
  if (String(room.hostId) !== String(userId)) throw socketError('NOT_HOST', 'Chi chu phong moi dieu khien Pomodoro.')
  return room
}

const validateRoomAction = (payload) => {
  const { value, error } = roomActionSchema.validate(payload, { abortEarly: false, stripUnknown: true })
  if (error) throw socketError('INVALID_PAYLOAD', 'Payload Pomodoro khong hop le.')
  return value
}

const withPomodoroLock = async (roomId, handler) => {
  const lockKey = `lock:pomo:${roomId}`
  const locked = await redisClient.set(lockKey, '1', 'EX', 3, 'NX')
  if (!locked) throw socketError('RATE_LIMITED', 'Thao tac dang duoc xu ly.')

  try {
    return await handler()
  } finally {
    await redisClient.del(lockKey)
  }
}

const phaseJobId = (roomId, cycle, phase) => `pomo-${roomId}-${cycle}-${phase}`

const removePhaseJob = async (roomId, cycle, phase) => {
  if (!cycle || !phase) return
  const job = await pomodoroQueue.getJob(phaseJobId(roomId, cycle, phase))
  if (job) await job.remove()
}

const addPhaseEndJob = async (roomId, cycle, phase, delaySec) => {
  await pomodoroQueue.add(
    POMODORO_JOB_NAME.PHASE_END,
    { roomId, expectedCycle: Number(cycle), expectedPhase: phase },
    { delay: delaySec * 1000, jobId: phaseJobId(roomId, cycle, phase), removeOnComplete: true }
  )
}

const registerPomodoroHandlers = (nsp, socket) => {
  const userId = socket.user._id

  socket.on(
    'pomodoro:start',
    safeHandler(async (payload) => {
      const { roomId } = validateRoomAction(payload)
      const room = await assertHost(roomId, userId)

      const result = await withPomodoroLock(roomId, async () => {
        const key = ROOM_REDIS_KEY.POMODORO(roomId)
        const current = await redisClient.hgetall(key)
        if (current?.status && current.status !== POMODORO_STATUS.IDLE) {
          throw socketError('INVALID_STATE', 'Pomodoro dang chay hoac dang tam dung.')
        }

        const durationSec = room.pomodoroWorkMin * 60
        const cycle = Number(current?.cycle ?? 0) + 1
        const startedAt = Date.now()

        await redisClient.hset(key, {
          status: POMODORO_STATUS.RUNNING,
          phase: POMODORO_PHASE.WORK,
          startedAt,
          durationSec,
          cycle
        })
        await redisClient.hdel(key, 'remainingSec')
        await redisClient.expire(key, ROOM_REDIS_TTL_SECONDS)

        await pomodoroSessionModel.create({
          roomId,
          startedBy: userId,
          phase: POMODORO_PHASE.WORK,
          durationMin: room.pomodoroWorkMin,
          startedAt: new Date(startedAt)
        })

        const onlineIds = await roomSessionService.listPresenceUserIds(roomId)
        await Promise.all(
          onlineIds.map((uid) =>
            redisClient.set(ROOM_REDIS_KEY.STUDY_MARK(roomId, uid), startedAt, 'EX', ROOM_REDIS_TTL_SECONDS)
          )
        )

        await addPhaseEndJob(roomId, cycle, POMODORO_PHASE.WORK, durationSec)
        return serializePomodoroState({
          status: POMODORO_STATUS.RUNNING,
          phase: POMODORO_PHASE.WORK,
          startedAt,
          durationSec,
          cycle
        })
      })

      nsp.to(`room:${roomId}`).emit('pomodoro:started', result)
      return result
    })
  )

  socket.on(
    'pomodoro:pause',
    safeHandler(async (payload) => {
      const { roomId } = validateRoomAction(payload)
      await assertHost(roomId, userId)

      const result = await withPomodoroLock(roomId, async () => {
        const key = ROOM_REDIS_KEY.POMODORO(roomId)
        const pomo = await redisClient.hgetall(key)
        if (pomo?.status !== POMODORO_STATUS.RUNNING) throw socketError('INVALID_STATE', 'Pomodoro khong chay.')

        const elapsedSec = Math.floor((Date.now() - Number(pomo.startedAt)) / 1000)
        const remainingSec = Math.max(0, Number(pomo.durationSec) - elapsedSec)
        await redisClient.hset(key, { status: POMODORO_STATUS.PAUSED, remainingSec })
        await removePhaseJob(roomId, pomo.cycle, pomo.phase)

        if (pomo.phase === POMODORO_PHASE.WORK) {
          await roomRealtimeService.settleAllStudyTime(roomId)
        }

        return serializePomodoroState({
          ...pomo,
          status: POMODORO_STATUS.PAUSED,
          remainingSec
        })
      })

      nsp.to(`room:${roomId}`).emit('pomodoro:paused', result)
      return result
    })
  )

  socket.on(
    'pomodoro:resume',
    safeHandler(async (payload) => {
      const { roomId } = validateRoomAction(payload)
      await assertHost(roomId, userId)

      const result = await withPomodoroLock(roomId, async () => {
        const key = ROOM_REDIS_KEY.POMODORO(roomId)
        const pomo = await redisClient.hgetall(key)
        if (pomo?.status !== POMODORO_STATUS.PAUSED) throw socketError('INVALID_STATE', 'Pomodoro khong tam dung.')

        const startedAt = Date.now()
        const durationSec = Number(pomo.remainingSec || pomo.durationSec)
        await redisClient.hset(key, {
          status: POMODORO_STATUS.RUNNING,
          startedAt,
          durationSec
        })
        await redisClient.hdel(key, 'remainingSec')
        await redisClient.expire(key, ROOM_REDIS_TTL_SECONDS)

        if (pomo.phase === POMODORO_PHASE.WORK) {
          const onlineIds = await roomSessionService.listPresenceUserIds(roomId)
          await Promise.all(
            onlineIds.map((uid) =>
              redisClient.set(ROOM_REDIS_KEY.STUDY_MARK(roomId, uid), startedAt, 'EX', ROOM_REDIS_TTL_SECONDS)
            )
          )
        }

        await addPhaseEndJob(roomId, pomo.cycle, pomo.phase, durationSec)
        return serializePomodoroState({
          ...pomo,
          status: POMODORO_STATUS.RUNNING,
          startedAt,
          durationSec
        })
      })

      nsp.to(`room:${roomId}`).emit('pomodoro:resumed', result)
      return result
    })
  )

  socket.on(
    'pomodoro:reset',
    safeHandler(async (payload) => {
      const { roomId } = validateRoomAction(payload)
      await assertHost(roomId, userId)

      await withPomodoroLock(roomId, async () => {
        const key = ROOM_REDIS_KEY.POMODORO(roomId)
        const pomo = await redisClient.hgetall(key)
        if (!pomo?.status) return

        await removePhaseJob(roomId, pomo.cycle, pomo.phase)
        if (pomo.phase === POMODORO_PHASE.WORK) {
          await roomRealtimeService.settleAllStudyTime(roomId)
          await pomodoroSessionModel.updateMany(
            { roomId, phase: POMODORO_PHASE.WORK, endedAt: null },
            { $set: { endedAt: new Date() } }
          )
        }

        await redisClient.del(key)
      })

      const result = serializePomodoroState()
      nsp.to(`room:${roomId}`).emit('pomodoro:reset', result)
      return result
    })
  )
}

export default registerPomodoroHandlers
