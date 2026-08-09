import { Queue } from 'bullmq'

import { createRedisClient } from '../configs/redis.config.js'
import { EMAIL_QUEUE_OPTIONS, QUEUE_BACKOFF_TYPE, QUEUE_NAME } from '../constants/index.js'

const connection = createRedisClient()

const emailQueue = new Queue(QUEUE_NAME.EMAIL, {
  connection,
  defaultJobOptions: {
    attempts: EMAIL_QUEUE_OPTIONS.ATTEMPTS,
    backoff: {
      type: QUEUE_BACKOFF_TYPE.EXPONENTIAL,
      delay: EMAIL_QUEUE_OPTIONS.BACKOFF_DELAY
    },
    removeOnComplete: EMAIL_QUEUE_OPTIONS.REMOVE_ON_COMPLETE
  }
})

export default emailQueue
