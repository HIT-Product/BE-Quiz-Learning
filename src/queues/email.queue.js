import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { envConfig } from '../configs/index.js'

const connection = new Redis({
  host: envConfig.redis.host,
  port: envConfig.redis.port,
  username: envConfig.redis.username,
  password: envConfig.redis.password,
  maxRetriesPerRequest: null
})

const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true
  }
})

export default emailQueue
