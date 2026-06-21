import jwt from 'jsonwebtoken'
import { StatusCodes } from 'http-status-codes'

import { ApiError, catchAsync } from '../utils/index.js'
import { envConfig } from '../configs/index.js'

const authMiddleware = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Vui lòng đăng nhập.')
  }

  const token = authHeader.split(' ')[1]

  let payload
  try {
    payload = jwt.verify(token, envConfig.jwt.secretLogin)
  } catch (err) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Token không hợp lệ hoặc đã hết hạn.')
  }

  req.user = payload
  next()
})

export default authMiddleware
