import { StatusCodes } from 'http-status-codes'

import { USER_ROLE } from '../constants/index.js'
import { userModel } from '../models/index.js'
import ApiError from '../utils/ApiError.js'
import catchAsync from '../utils/catchAsync.js'

const adminMiddleware = catchAsync(async (req, res, next) => {
  const isAdmin = await userModel.exists({
    _id: req.user._id,
    role: USER_ROLE.ADMIN
  })

  if (!isAdmin) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền truy cập khu vực quản trị.')
  }

  next()
})

export default adminMiddleware
