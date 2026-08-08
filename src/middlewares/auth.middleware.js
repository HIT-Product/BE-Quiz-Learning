import mongoose from 'mongoose'
import { StatusCodes } from 'http-status-codes'

import { sessionModel } from '../models/index.js'
import { ApiError, catchAsync, jwtUtils } from '../utils/index.js'

const unauthorizedSession = () => new ApiError(StatusCodes.UNAUTHORIZED, 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi.')
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

  if (!mongoose.isValidObjectId(payload._id) || !mongoose.isValidObjectId(payload.sessionId)) {
    throw unauthorizedSession()
  }

  const session = await sessionModel.exists({
    _id: payload.sessionId,
    userId: payload._id,
    expiresAt: { $gt: new Date() }
  })

  if (!session) {
    throw unauthorizedSession()
  }

  req.user = payload
  next()
})

export default authMiddleware
