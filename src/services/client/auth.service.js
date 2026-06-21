import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { StatusCodes } from 'http-status-codes'

import { userModel, sessionModel } from '../../models/index.js'
import { emailQueue } from '../../queues/index.js'
import { ApiError, hashToken, logger } from '../../utils/index.js'
import { envConfig } from '../../configs/index.js'

// Tạo cặp accessToken + refreshToken từ thông tin user
const generateTokens = (user) => {
  const accessToken = jwt.sign({ _id: user._id, email: user.email }, envConfig.jwt.secretLogin, {
    expiresIn: envConfig.jwt.expiresInLogin
  })

  const refreshToken = jwt.sign({ _id: user._id }, envConfig.jwt.secretRefresh, {
    expiresIn: envConfig.jwt.expiresInRefresh
  })

  return { accessToken, refreshToken }
}

// Bỏ passwordHash trước khi trả user về client
const sanitizeUser = (user) => {
  const obj = user.toObject()
  delete obj.passwordHash
  return obj
}

const register = async ({ email, password, displayName }) => {
  const existing = await userModel.findOne({ email })
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const passwordHash = await bcrypt.hash(password, envConfig.bcrypt.saltRounds)

  const user = await userModel.create({ email, passwordHash, displayName })

  // Đẩy job gửi email chào mừng — lỗi Redis không được làm fail việc đăng ký
  try {
    await emailQueue.add('welcome', { email: user.email, displayName: user.displayName })
  } catch (err) {
    logger.error(`Không thể đẩy job email chào mừng: ${err.message}`)
  }

  return sanitizeUser(user)
}

const login = async ({ email, password }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Email hoặc mật khẩu không đúng.')
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Email hoặc mật khẩu không đúng.')
  }

  const { accessToken, refreshToken } = generateTokens(user)

  // Lưu HASH của refreshToken vào 1 session mới (mỗi lần login = 1 thiết bị)
  const { exp } = jwt.decode(refreshToken)
  await sessionModel.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(exp * 1000)
  })

  return { accessToken, refreshToken, user: sanitizeUser(user) }
}

const refreshToken = async (token) => {
  // 1. Verify chữ ký + hạn của refreshToken
  let payload
  try {
    payload = jwt.verify(token, envConfig.jwt.secretRefresh)
  } catch (err) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'refreshToken không hợp lệ hoặc đã hết hạn.')
  }

  // 2. Tìm session theo hash — không có nghĩa là đã bị rotate/logout/TTL xóa
  const session = await sessionModel.findOne({ tokenHash: hashToken(token) })
  if (!session) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Phiên đăng nhập không tồn tại.')
  }

  const user = await userModel.findById(payload._id)
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Người dùng không tồn tại.')
  }

  // 3. Cấp token mới và ROTATE: cập nhật chính session đó
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user)

  const { exp } = jwt.decode(newRefreshToken)
  session.tokenHash = hashToken(newRefreshToken)
  session.expiresAt = new Date(exp * 1000)
  await session.save()

  return { accessToken, refreshToken: newRefreshToken }
}

// Thoát 1 thiết bị: xóa đúng session ứng với refreshToken
const logout = async (token) => {
  await sessionModel.deleteOne({ tokenHash: hashToken(token) })
}

// Thoát mọi thiết bị: xóa tất cả session của user
const logoutAll = async (userId) => {
  await sessionModel.deleteMany({ userId })
}

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll
}
