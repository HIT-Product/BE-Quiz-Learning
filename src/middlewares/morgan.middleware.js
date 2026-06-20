import morgan from 'morgan'
import { logger } from '../utils/index.js'

const stream = {
  write: (message) => {
    const statusCode = parseInt(message.match(/(?<= \[)\d+(?=\])/g)?.[0] || '200', 10)

    if (statusCode >= 500) {
      logger.error(message.trim())
    } else if (statusCode >= 400) {
      logger.warn(message.trim())
    } else {
      logger.info(message.trim())
    }
  }
}

morgan.token('body', (req) => JSON.stringify(req.body))
morgan.token('params', (req) => JSON.stringify(req.params))

const morganMiddleware = morgan('[:method] [:status] :url :response-time ms - Params: :params - Body: :body', {
  stream
})

export default morganMiddleware
