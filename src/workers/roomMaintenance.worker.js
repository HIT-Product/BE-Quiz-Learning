import { Worker } from 'bullmq'

import { createRedisClient } from '../configs/index.js'
import {
  QUEUE_EVENT,
  QUEUE_NAME,
  ROOM_MAINTENANCE_JOB_NAME,
  ROOM_MAINTENANCE_QUEUE_OPTIONS
} from '../constants/index.js'
import { logger } from '../utils/index.js'
import { roomRealtimeService } from '../sockets/services/index.js'

const createRoomMaintenanceWorker = (nsp) => {
  const worker = new Worker(
    QUEUE_NAME.ROOM_MAINTENANCE,
    async (job) => {
      if (job.name !== ROOM_MAINTENANCE_JOB_NAME.CLOSE_IDLE_ROOMS) return null

      const stats = await roomRealtimeService.closeIdleRooms(nsp)
      logger.info(
        `Room maintenance ${job.name}: scanned=${stats.scanned} closed=${stats.closed} recovered=${stats.recovered} skipped=${stats.skipped} failed=${stats.failed}`
      )
      return stats
    },
    {
      connection: createRedisClient(),
      concurrency: ROOM_MAINTENANCE_QUEUE_OPTIONS.CONCURRENCY
    }
  )

  worker.on(QUEUE_EVENT.COMPLETED, (job) => {
    logger.info(`Room maintenance job ${job.id} completed`)
  })

  worker.on(QUEUE_EVENT.FAILED, (job, err) => {
    logger.error(`Room maintenance job ${job?.id} failed: ${err.message}`)
  })

  return worker
}

export { createRoomMaintenanceWorker }
