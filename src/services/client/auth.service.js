import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import crypto from 'node:crypto'
import { StatusCodes } from 'http-status-codes'

import { envConfig } from '../../configs/index.js'
import { emailQueue } from '../../queues/index.js'
import { ApiError, hashToken, jwtUtils, logger } from '../../utils/index.js'
import { userModel, sessionModel, passwordResetModel } from '../../models/index.js'
// === Dùng chung: Tạo cặp token và lưu phiên đăng nhập ===
const issueTokens = async (user) => {
  const session = new sessionModel({ userId: user._id })

  const accessToken = jwtUtils.generateAccessToken(user, session._id)
  const refreshToken = jwtUtils.generateRefreshToken(user, session._id)
  const { exp } = jwtUtils.decodeToken(refreshToken)

  session.tokenHash = hashToken(refreshToken)
  session.expiresAt = new Date(exp * 1000)
  await session.save()

  return { accessToken, refreshToken }
}
// === Chức năng: Đăng ký tài khoản ===
const register = async ({ email, password, displayName }) => {
  const existing = await userModel.findOne({ email })
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const passwordHash = await bcrypt.hash(password, envConfig.bcrypt.saltRounds)
  const user = await userModel.create({ email, passwordHash, displayName })

  try {
    await emailQueue.add('welcome', { email: user.email, displayName: user.displayName })
  } catch (err) {
    logger.error(`Không thể đẩy job email chào mừng: ${err.message}`)
  }

  return issueTokens(user)
}
// === Chức năng: Đăng nhập bằng email và mật khẩu ===
const login = async ({ email, password }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Email hoặc mật khẩu không đúng.')
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Email hoặc mật khẩu không đúng.')
  }

  return issueTokens(user)
}
// === Chức năng: Xoay vòng refresh token ===
const refreshToken = async (token) => {
  let payload
  try {
    payload = jwtUtils.verifyRefreshToken(token)
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'refreshToken không hợp lệ hoặc đã hết hạn.')
  }

  if (!mongoose.isValidObjectId(payload._id) || !mongoose.isValidObjectId(payload.sessionId)) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Phiên đăng nhập không hợp lệ.')
  }

  const session = await sessionModel.findOne({
    _id: payload.sessionId,
    userId: payload._id,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() }
  })
  if (!session) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Phiên đăng nhập không tồn tại.')
  }

  const user = await userModel.findById(payload._id)
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Người dùng không tồn tại.')
  }

  const accessToken = jwtUtils.generateAccessToken(user, session._id)
  const newRefreshToken = jwtUtils.generateRefreshToken(user, session._id)
  const { exp } = jwtUtils.decodeToken(newRefreshToken)

  session.tokenHash = hashToken(newRefreshToken)
  session.expiresAt = new Date(exp * 1000)
  await session.save()

  return { accessToken, refreshToken: newRefreshToken }
}
// === Chức năng: Thu hồi phiên đăng nhập hiện tại ===
const logout = async (token) => {
  await sessionModel.deleteOne({ tokenHash: hashToken(token) })
}
// === Chức năng: Thu hồi toàn bộ phiên của người dùng ===
const logoutAll = async (userId) => {
  await sessionModel.deleteMany({ userId })
}
// === Chức năng: Đổi mật khẩu và tùy chọn đăng xuất thiết bị khác ===
const changePassword = async ({ userId, currentSessionId, oldPassword, newPassword, logoutOtherDevices }) => {
  const user = await userModel.findById(userId)
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Người dùng không tồn tại.')
  }
  if (!user.passwordHash) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Người dùng không có mật khẩu để thay đổi.')
  }
  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash)
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Mật khẩu cũ không đúng.')
  }

  const isSame = await bcrypt.compare(newPassword, user.passwordHash)
  if (isSame) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Mật khẩu mới không được trùng với mật khẩu cũ.')
  }

  user.passwordHash = await bcrypt.hash(newPassword, envConfig.bcrypt.saltRounds)
  await user.save()

  if (logoutOtherDevices) {
    await sessionModel.deleteMany({
      userId,
      _id: { $ne: currentSessionId }
    })
  }

  return {
    loggedOutOtherDevices: Boolean(logoutOtherDevices)
  }
}

const OTP_TTL_MS = 10 * 60 * 1000 // 10 phut
// === Chức năng: Tạo và gửi OTP khôi phục mật khẩu ===
const forgotPassword = async ({ email }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    return
  }
  const otp = crypto.randomInt(100000, 1000000).toString()
  await passwordResetModel.deleteMany({ userId: user._id })
  await passwordResetModel.create({
    userId: user._id,
    otpHash: hashToken(otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS)
  })
  try {
    await emailQueue.add('reset-password', {
      email: user.email,
      displayName: user.displayName,
      otp
    })
  } catch (err) {
    logger.error(`Khong the day job email quen mat khau: ${err.message}`)
  }
}
// === Chức năng: Xác thực OTP và đặt lại mật khẩu ===
const resetPassword = async ({ email, otp, newPassword }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  const record = await passwordResetModel.findOne({ userId: user._id })
  if (!record || record.expiresAt < new Date()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  if (record.otpHash !== hashToken(otp)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }
  user.passwordHash = await bcrypt.hash(newPassword, envConfig.bcrypt.saltRounds)
  await user.save()
  await passwordResetModel.deleteMany({ userId: user._id })
  await sessionModel.deleteMany({ userId: user._id })
}
const generateGooglePassword = () => {
  return 'google_' + crypto.randomBytes(32).toString('hex') + '_' + Date.now()
}
const googleLogin = async (profile) => {
  if (!profile) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Xác thực Google thất bại.')
  }

  const rawEmail = profile.emails?.find(({ verified }) => verified)?.value || profile.emails?.[0]?.value

  if (!rawEmail?.trim()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Tài khoản Google không cung cấp email.')
  }

  const email = rawEmail.trim().toLowerCase()
  const displayName = profile.displayName?.trim() || email.split('@')[0]
  const avatarUrl = profile.photos?.[0]?.value || null

  let user = await userModel.findOne({ email })

  if (!user) {
    const rawPassword = generateGooglePassword()
    const passwordHash = await bcrypt.hash(rawPassword, envConfig.bcrypt.saltRounds)

    user = await userModel.create({
      email,
      passwordHash,
      displayName,
      avatarUrl
    })

    try {
      await emailQueue.add('welcome', { email: user.email, displayName: user.displayName })
    } catch (err) {
      logger.error(`Khong the day job email chao mung: ${err.message}`)
    }
  }

  return issueTokens(user)
}

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  googleLogin
}
