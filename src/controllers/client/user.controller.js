import { StatusCodes } from 'http-status-codes'
import { userService } from '../../services/client/index.js'
import { ApiError, catchAsync, response } from '../../utils/index.js'
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

// [POST] /users/me/avatar
const uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Vui long chon file avatar.')
  }

  const user = await userService.updateAvatar(req.user._id, req.file.buffer)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cap nhat avatar thanh cong.', user))
})

// [DELETE] /users/me/avatar
const removeAvatar = catchAsync(async (req, res) => {
  const user = await userService.removeAvatar(req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Xoa avatar thanh cong.', user))
})

const updateUsername = catchAsync(async (req, res) => {
  const user = await userService.setUsername(req.user._id, req.body.username)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật username thành công.', user))
})

const checkUsernameAvailable = catchAsync(async (req, res) => {
  const data = await userService.isUsernameAvailable(req.query.username, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Kiểm tra username thành công.', data))
})

const updatePrivacy = catchAsync(async (req, res) => {
  const data = await userService.updatePrivacy(req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật quyền riêng tư thành công.', data))
})

export default {
  getMe,
  updateMe,
  uploadAvatar,
  removeAvatar,
  updateUsername,
  checkUsernameAvailable,
  updatePrivacy
}
