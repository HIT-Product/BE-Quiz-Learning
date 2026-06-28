import { StatusCodes } from 'http-status-codes'
import { userService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'
// [GET] /users/me
const getMe = catchAsync(async (req, res) => {
  const user = await userService.getProfile(req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay thong tin ca nhan thanh cong.', user))
})
// [PUT] /users/me
const updateMe = catchAsync(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cap nhat thong tin ca nhan thanh cong.', user))
})

export default {
  getMe,
  updateMe
}
