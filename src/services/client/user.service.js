import { StatusCodes } from 'http-status-codes'
import { userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
// === Chức năng: Lấy hồ sơ cá nhân ===
const getProfile = async (userId) => {
  const user = await userModel.findById(userId).select('-passwordHash')
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay nguoi dung.')
  }
  return user
}
// === Chức năng: Cập nhật các trường hồ sơ được cho phép ===
const updateProfile = async (userId, updateData) => {
  const allowedFields = ['displayName', 'avatarUrl', 'defaultQuizSize']
  const updateFields = {}
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field]
    }
  }

  const user = await userModel
    .findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true })
    .select('-passwordHash')
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay nguoi dung.')
  }
  return user
}

export default {
  getProfile,
  updateProfile
}
