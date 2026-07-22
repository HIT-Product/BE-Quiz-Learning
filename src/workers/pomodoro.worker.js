import { Worker } from 'bullmq'

import { createRedisClient, redisClient } from '../configs/index.js'
import { pomodoroSessionModel, studyRoomModel } from '../models/index.js'
import { pomodoroQueue } from '../queues/index.js'
import { roomRealtimeService } from '../sockets/services/index.js'
import { serializePomodoroState } from '../sockets/contracts/pomodoro.contract.js'
import { logger } from '../utils/index.js'
import {
  POMODORO_JOB_NAME,
  POMODORO_PHASE,
  POMODORO_STATUS,
  QUEUE_EVENT,
  QUEUE_NAME,
  ROOM_REDIS_KEY
} from '../constants/index.js'

const handlePhaseEnd = async (nsp, { roomId, expectedCycle, expectedPhase }) => {
  const key = ROOM_REDIS_KEY.POMODORO(roomId)
  const pomo = await redisClient.hgetall(key)

  if (!pomo || pomo.status !== POMODORO_STATUS.RUNNING) return { skipped: true }
  if (Number(pomo.cycle) !== Number(expectedCycle) || pomo.phase !== expectedPhase) return { skipped: true }

  if (expectedPhase === POMODORO_PHASE.WORK) {
    await roomRealtimeService.settleAllStudyTime(roomId)
    const leaderboard = await roomRealtimeService.buildLeaderboard(roomId)
    await roomRealtimeService.flushLeaderboardToDB(roomId)
    nsp.to(`room:${roomId}`).emit('leaderboard:updated', leaderboard)

    await pomodoroSessionModel.updateOne({ roomId, phase: POMODORO_PHASE.WORK, endedAt: null }, { endedAt: new Date() })

    const room = await studyRoomModel.findById(roomId).select('pomodoroBreakMin').lean()
    if (!room) return { skipped: true }

    const durationSec = room.pomodoroBreakMin * 60
    const startedAt = Date.now()
    await redisClient.hset(key, {
      phase: POMODORO_PHASE.BREAK,
      startedAt,
      durationSec
    })

    await pomodoroQueue.add(
      POMODORO_JOB_NAME.PHASE_END,
      { roomId, expectedCycle, expectedPhase: POMODORO_PHASE.BREAK },
      {
        delay: durationSec * 1000,
        jobId: `pomo-${roomId}-${expectedCycle}-break`,
        removeOnComplete: true
      }
    )

    nsp.to(`room:${roomId}`).emit(
      'pomodoro:phase-changed',
      serializePomodoroState({
        status: POMODORO_STATUS.RUNNING,
        phase: POMODORO_PHASE.BREAK,
        startedAt,
        durationSec,
        cycle: expectedCycle
      })
    )

    return { skipped: false, nextPhase: POMODORO_PHASE.BREAK }
  }

  await redisClient.hset(key, { status: POMODORO_STATUS.IDLE })
  await redisClient.hdel(key, 'phase', 'startedAt', 'durationSec', 'remainingSec')
  nsp.to(`room:${roomId}`).emit(
    'pomodoro:phase-changed',
    serializePomodoroState({
      status: POMODORO_STATUS.IDLE,
      cycle: expectedCycle
    })
  )

  return { skipped: false, nextPhase: null }
}

const createPomodoroWorker = (nsp) => {
  const worker = new Worker(
    QUEUE_NAME.POMODORO,
    async (job) => {
      if (job.name !== POMODORO_JOB_NAME.PHASE_END) return null
      return handlePhaseEnd(nsp, job.data)
    },
    {
      connection: createRedisClient(),
      concurrency: 1
    }
  )

  worker.on(QUEUE_EVENT.COMPLETED, (job) => {
    logger.info(`Pomodoro job ${job.id} completed`)
  })

  worker.on(QUEUE_EVENT.FAILED, (job, err) => {
    logger.error(`Pomodoro job ${job?.id} failed: ${err.message}`)
  })

  return worker
}

export { createPomodoroWorker }
