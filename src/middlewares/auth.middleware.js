import { StatusCodes } from 'http-status-codes'
import { ApiError, catchAsync, jwtUtils } from '../utils/index.js'

const authMiddleware = catchAsync(async (req, res, next) => {
  const token = jwtUtils.extractToken(req)
  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Vui lòng đăng nhập.')
  }

  let payload
  try {
    payload = jwtUtils.verifyAccessToken(token)
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Token không hợp lệ hoặc đã hết hạn.')
  }

  req.user = payload
  next()
})

export default authMiddleware
