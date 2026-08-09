import Redis from 'ioredis'

import envConfig from './env.config.js'

const createRedisClient = () => {
  const options = { maxRetriesPerRequest: null }

  if (envConfig.redis.url) {
    return new Redis(envConfig.redis.url, options)
  }

  return new Redis({
    ...options,
    host: envConfig.redis.host,
    port: envConfig.redis.port,
    username: envConfig.redis.username || undefined,
    password: envConfig.redis.password || undefined
  })
}

const redisClient = createRedisClient()

export { createRedisClient, redisClient }
