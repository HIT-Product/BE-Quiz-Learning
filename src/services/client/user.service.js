import { StatusCodes } from 'http-status-codes'
import { userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import cloudinaryService from '../cloudinary.service.js'

// Lấy hồ sơ cá nhân
const getProfile = async (userId) => {
  const user = await userModel.findById(userId).select('-passwordHash')
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay nguoi dung.')
  }
  return user
}

// Cập nhật hồ sơ cá nhân
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

const updateAvatar = async (userId, buffer) => {
  const uploadResult = await cloudinaryService.uploadAvatar(buffer, userId)
  return updateProfile(userId, { avatarUrl: uploadResult.secure_url })
}

const removeAvatar = async (userId) => {
  await cloudinaryService.deleteAvatar(userId)
  return updateProfile(userId, { avatarUrl: null })
}

export default {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar
}
