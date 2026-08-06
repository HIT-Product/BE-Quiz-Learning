import { StatusCodes } from 'http-status-codes'
import { userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import cloudinaryService from '../cloudinary.service.js'
import {
  SOCIAL_LIMITS,
  USERNAME_PATTERN,
  USERNAME_RESERVED
} from '../../constants/index.js'

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
  const allowedFields = ['displayName', 'defaultQuizSize']
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

const setAvatarUrl = async (userId, avatarUrl) => {
  const user = await userModel
    .findByIdAndUpdate(userId, { $set: { avatarUrl } }, { new: true, runValidators: true })
    .select('-passwordHash')
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay nguoi dung.')
  }
  return user
}

const updateAvatar = async (userId, buffer) => {
  const uploadResult = await cloudinaryService.uploadAvatar(buffer, userId)
  return setAvatarUrl(userId, uploadResult.secure_url)
}

const removeAvatar = async (userId) => {
  await cloudinaryService.deleteAvatar(userId)
  return setAvatarUrl(userId, null)
}

const normalizeUsername = (value) => String(value || '').trim().toLowerCase()

const validateUsername = (value) => {
  const username = normalizeUsername(value)

  if (!USERNAME_PATTERN.test(username) || username.includes('..') || username.includes('__')) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Username không đúng định dạng.')
  }
  if (USERNAME_RESERVED.includes(username)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Username này không được phép sử dụng.')
  }
  return username
}

const setUsername = async (userId, rawUsername) => {
  const username = validateUsername(rawUsername)
  const user = await userModel.findById(userId).select('username usernameUpdatedAt')
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy người dùng.')

  if (user.username === username) return userModel.findById(userId).select('-passwordHash -__v')

  if (user.usernameUpdatedAt) {
    const nextAllowedAt = new Date(user.usernameUpdatedAt)
    nextAllowedAt.setUTCDate(nextAllowedAt.getUTCDate() + SOCIAL_LIMITS.USERNAME_CHANGE_COOLDOWN_DAYS)
    if (nextAllowedAt > new Date()) {
      const error = new ApiError(StatusCodes.CONFLICT, 'Chưa đến thời điểm được đổi username.')
      error.nextAllowedAt = nextAllowedAt
      throw error
    }
  }

  try {
    return await userModel
      .findByIdAndUpdate(
        userId,
        { $set: { username, usernameUpdatedAt: new Date() } },
        { new: true, runValidators: true }
      )
      .select('-passwordHash -__v')
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(StatusCodes.CONFLICT, 'Username đã được sử dụng.')
    }
    throw error
  }
}

const isUsernameAvailable = async (rawUsername, currentUserId) => {
  const username = validateUsername(rawUsername)
  const exists = await userModel.exists({
    username,
    _id: { $ne: currentUserId }
  })
  return { username, available: !exists }
}

const updatePrivacy = async (userId, data) => {
  const update = {}
  if (data.activityVisibility !== undefined) update.activityVisibility = data.activityVisibility
  if (data.friendRequestPolicy !== undefined) update.friendRequestPolicy = data.friendRequestPolicy

  const user = await userModel
    .findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
    .select('username activityVisibility friendRequestPolicy')

  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy người dùng.')
  return user
}

export default {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  setUsername,
  isUsernameAvailable,
  updatePrivacy
}
