import morgan from 'morgan'

import {
  HTTP_STATUS_FALLBACK,
  HTTP_STATUS_LEVEL,
  MORGAN_FORMAT,
  MORGAN_STATUS_PATTERN,
  MORGAN_TOKEN,
  NUMBER_PARSE_RADIX
} from '../constants/index.js'
import { logger } from '../utils/index.js'

const stream = {
  write: (message) => {
    const statusCode = parseInt(message.match(MORGAN_STATUS_PATTERN)?.[0] || HTTP_STATUS_FALLBACK, NUMBER_PARSE_RADIX)

    if (statusCode >= HTTP_STATUS_LEVEL.ERROR) {
      logger.error(message.trim())
    } else if (statusCode >= HTTP_STATUS_LEVEL.WARN) {
      logger.warn(message.trim())
    } else {
      logger.info(message.trim())
    }
  }
}

morgan.token(MORGAN_TOKEN.BODY, (req) => JSON.stringify(req.body))
morgan.token(MORGAN_TOKEN.PARAMS, (req) => JSON.stringify(req.params))

const morganMiddleware = morgan(MORGAN_FORMAT, {
  stream
})

export default morganMiddleware
