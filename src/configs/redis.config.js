import Redis from 'ioredis'

import envConfig from './env.config.js'

const createRedisClient = () =>
  new Redis({
    host: envConfig.redis.host,
    port: envConfig.redis.port,
    username: envConfig.redis.username || undefined,
    password: envConfig.redis.password || undefined,
    maxRetriesPerRequest: null
  })

const redisClient = createRedisClient()

export { createRedisClient, redisClient }
