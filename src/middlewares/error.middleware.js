import mongoose from 'mongoose'
import { StatusCodes, getReasonPhrase } from 'http-status-codes'

import { logger } from '../utils/index.js'
import { ApiError } from '../utils/index.js'
import { envConfig } from '../configs/index.js'

const errorConverter = (err, req, res, next) => {
  let error = err

  if (!(error instanceof ApiError)) {
    const isMongooseError = error instanceof mongoose.Error

    const statusCode =
      error.statusCode || (isMongooseError ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR)

    const message = error.message || getReasonPhrase(statusCode)

    error = new ApiError(statusCode, message, false, err.stack)
  }

  next(error)
}

const errorHandler = async (err, req, res, next) => {
  let { statusCode, message } = err

  if (envConfig.server.nodeEnv === 'production' && !err.isOperational) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR
    message = 'Server xảy ra lỗi, vui lòng thử lại sau.'
  }

  res.locals.errorMessage = err.message

  const response = {
    statusCode,
    message,
    ...(envConfig.server.nodeEnv === 'development' && { stack: err.stack })
  }

  if (envConfig.server.nodeEnv === 'development') {
    logger.error(err.stack || err)
  }

  return res.status(statusCode).send(response)
}

export default { errorHandler, errorConverter }
