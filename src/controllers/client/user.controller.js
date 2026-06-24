import { StatusCodes } from 'http-status-codes'
import { userService } from '../../services/client/index.js'
import { ApiError, catchAsync, response } from '../../utils/index.js'
// === Chức năng: Lấy hồ sơ người dùng hiện tại ===
const getMe = catchAsync(async (req, res) => {
  const user = await userService.getProfile(req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay thong tin ca nhan thanh cong.', user))
})
// === Chức năng: Cập nhật hồ sơ người dùng hiện tại ===
const updateMe = catchAsync(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cap nhat thong tin ca nhan thanh cong.', user))
})

export default {
  getMe,
  updateMe
}
