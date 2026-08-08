import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { envConfig } from '../configs/index.js'
import { EMAIL_QUEUE_OPTIONS, QUEUE_BACKOFF_TYPE, QUEUE_NAME } from '../constants/index.js'

const connection = new Redis({
  host: envConfig.redis.host,
  port: envConfig.redis.port,
  username: envConfig.redis.username,
  password: envConfig.redis.password,
  maxRetriesPerRequest: null
})

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
