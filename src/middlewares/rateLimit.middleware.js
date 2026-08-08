import { StatusCodes } from 'http-status-codes'

import { redisClient } from '../configs/index.js'
import { response } from '../utils/index.js'

const rateLimitMiddleware =
  ({ keyPrefix, max, windowSec, message }) =>
  async (req, res, next) => {
    try {
      const userKey = req.user?._id ? String(req.user._id) : req.ip
      const key = `rl:${keyPrefix}:${userKey}`
      const count = await redisClient.incr(key)
      if (count === 1) await redisClient.expire(key, windowSec)

      if (count > max) {
        return res
          .status(StatusCodes.TOO_MANY_REQUESTS)
          .json(response(StatusCodes.TOO_MANY_REQUESTS, message || 'Ban thao tac qua nhanh. Vui long thu lai sau.'))
      }

      next()
    } catch (error) {
      next(error)
    }
  }

export default rateLimitMiddleware
