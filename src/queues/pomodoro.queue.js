import { Queue } from 'bullmq'

import { createRedisClient } from '../configs/index.js'
import { QUEUE_NAME } from '../constants/index.js'

const pomodoroQueue = new Queue(QUEUE_NAME.POMODORO, {
  connection: createRedisClient(),
  defaultJobOptions: {
    removeOnComplete: true
  }
})

export default pomodoroQueue
