import { Queue } from 'bullmq'

import { createRedisClient } from '../configs/redis.config.js'
import { QUEUE_NAME } from '../constants/index.js'

const roomMaintenanceQueue = new Queue(QUEUE_NAME.ROOM_MAINTENANCE, {
  connection: createRedisClient(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true
  }
})

export default roomMaintenanceQueue
