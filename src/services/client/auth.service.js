import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import crypto from 'node:crypto'
import { StatusCodes } from 'http-status-codes'

import { envConfig } from '../../configs/index.js'
import { emailQueue } from '../../queues/index.js'
import { ApiError, hashToken, jwtUtils, logger } from '../../utils/index.js'
import { userModel, sessionModel, passwordResetModel, pendingRegistrationModel } from '../../models/index.js'

// Tao token va phien dang nhap

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

// Dang nhap
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

// Lam moi refresh token
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

// Dang xuat
const logout = async (token) => {
  await sessionModel.deleteOne({ tokenHash: hashToken(token) })
}

// Dang xuat tat ca thiet bi
const logoutAll = async (userId) => {
  await sessionModel.deleteMany({ userId })
}

// Doi mat khau
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

const OTP_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_RESENDS = 5

// Gui OTP quen mat khau
const forgotPassword = async ({ email }) => {
  const user = await userModel.findOne({ email })
  if (!user) return

  const existing = await passwordResetModel.findOne({ userId: user._id })

  if (existing && existing.expiresAt > new Date()) {
    if (existing.lastSentAt && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
    }
    if (existing.sendCount >= MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui OTP qua nhieu lan. Vui long thu lai sau.')
    }
  }

  const otp = crypto.randomInt(100000, 1000000).toString()

  const update = {
    $set: {
      otpHash: hashToken(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastSentAt: new Date(),
      attemptCount: 0
    }
  }

  if (existing) {
    update.$inc = { sendCount: 1 }
  } else {
    update.$setOnInsert = { sendCount: 1 }
  }

  await passwordResetModel.findOneAndUpdate(
    { userId: user._id },
    update,
    { upsert: true }
  )

  try {
    await emailQueue.add('reset-password', {
      email: user.email,
      displayName: user.displayName,
      otp
    })
  } catch (err) {
    logger.error(`Khong the day job email quen mat khau: ${err.message}`)
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }
}

// Dat lai mat khau bang OTP
const resetPassword = async ({ email, otp, newPassword }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  const record = await passwordResetModel.findOne({ userId: user._id })
  if (!record || record.expiresAt < new Date()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  if (record.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    await passwordResetModel.deleteOne({ _id: record._id })
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Ban da nhap sai OTP qua nhieu lan. Vui long yeu cau OTP moi.')
  }

  if (record.otpHash !== hashToken(otp)) {
    record.attemptCount += 1
    await record.save()
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  if (user.passwordHash) {
    const isSame = await bcrypt.compare(newPassword, user.passwordHash)
    if (isSame) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Mat khau moi khong duoc trung voi mat khau cu.')
    }
  }

  user.passwordHash = await bcrypt.hash(newPassword, envConfig.bcrypt.saltRounds)
  await user.save()
  await passwordResetModel.deleteMany({ userId: user._id })
  await sessionModel.deleteMany({ userId: user._id })
}

// Gui lai OTP quen mat khau
const resendForgotPasswordOtp = async ({ email }) => {
  const user = await userModel.findOne({ email })
  if (!user) return

  const otp = crypto.randomInt(100000, 1000000).toString()
  const now = Date.now()

  const updated = await passwordResetModel.findOneAndUpdate(
    {
      userId: user._id,
      expiresAt: { $gt: new Date() },
      $or: [
        { lastSentAt: { $exists: false } },
        { lastSentAt: { $lte: new Date(now - RESEND_COOLDOWN_MS) } }
      ],
      sendCount: { $lt: MAX_RESENDS }
    },
    {
      $set: {
        otpHash: hashToken(otp),
        expiresAt: new Date(now + OTP_TTL_MS),
        lastSentAt: new Date(now),
        attemptCount: 0
      },
      $inc: { sendCount: 1 }
    },
    { new: true }
  )

  if (!updated) {
    const record = await passwordResetModel.findOne({ userId: user._id })
    if (!record) {
      return forgotPassword({ email })
    }
    if (record.sendCount >= MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui lai OTP qua nhieu lan. Vui long thu lai sau.')
    }
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
  }

  try {
    await emailQueue.add('reset-password', {
      email: user.email,
      displayName: user.displayName,
      otp
    })
  } catch (err) {
    logger.error(`Khong the day job email resend OTP: ${err.message}`)
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }
}

// Tao mat khau Google
const generateGooglePassword = () => {
  return 'google_' + crypto.randomBytes(32).toString('hex') + '_' + Date.now()
}

// Dang nhap Google
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

const REGISTER_OTP_TTL_MS = 5 * 60 * 1000
const REGISTER_RESEND_COOLDOWN_MS = 60 * 1000
const REGISTER_MAX_RESENDS = 5
const MAX_VERIFY_ATTEMPTS = 5

const pushRegisterOtpEmail = async ({ email, displayName, otp }) => {
  try {
    await emailQueue.add('register-otp', { email, displayName, otp })
  } catch (err) {
    logger.error(`Khong the day job email OTP dang ky: ${err.message}`)
  }
}

const requestRegisterOtp = async ({ email, password, displayName }) => {
  const existing = await userModel.findOne({ email })
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const pending = await pendingRegistrationModel.findOne({ email })

  // Pending con hieu luc thi van ap dung cooldown va gioi han gui
  if (pending && pending.expiresAt > new Date()) {
    if (pending.lastSentAt && Date.now() - pending.lastSentAt.getTime() < REGISTER_RESEND_COOLDOWN_MS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
    }
    if (pending.sendCount >= REGISTER_MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui OTP qua nhieu lan. Vui long dang ky lai sau.')
    }
  }

  const passwordHash = await bcrypt.hash(password, envConfig.bcrypt.saltRounds)
  const otp = crypto.randomInt(100000, 1000000).toString()

  const update = {
    $set: {
      passwordHash,
      displayName,
      otpHash: hashToken(otp),
      expiresAt: new Date(Date.now() + REGISTER_OTP_TTL_MS),
      lastSentAt: new Date(),
      attemptCount: 0
    }
  }

  if (pending) {
    update.$inc = { sendCount: 1 }
  } else {
    update.$setOnInsert = { sendCount: 1 }
  }

  await pendingRegistrationModel.findOneAndUpdate(
    { email },
    update,
    { upsert: true, new: true }
  )

  try {
    await pushRegisterOtpEmail({ email, displayName, otp })
  } catch (err) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }

  return { email, expiresIn: REGISTER_OTP_TTL_MS / 1000 }
}

// Xac thuc OTP va tao tai khoan
const verifyRegisterOtp = async ({ email, otp }) => {
  const pending = await pendingRegistrationModel.findOne({ email })
  if (!pending || pending.expiresAt < new Date()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  // Chặn brute-force: quá số lần nhập sai thì hủy pending, bắt đăng ký lại
  if (pending.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    await pendingRegistrationModel.deleteOne({ _id: pending._id })
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Ban da nhap sai OTP qua nhieu lan. Vui long dang ky lai.')
  }

  if (pending.otpHash !== hashToken(otp)) {
    pending.attemptCount += 1
    await pending.save()
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  // Chống race: email có thể vừa được tạo bởi luồng khác giữa lúc gửi và xác thực
  const existing = await userModel.findOne({ email })
  if (existing) {
    await pendingRegistrationModel.deleteOne({ _id: pending._id })
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  // Tạo user thật từ thông tin đã lưu
  const user = await userModel.create({
    email: pending.email,
    passwordHash: pending.passwordHash,
    displayName: pending.displayName
  })

  await pendingRegistrationModel.deleteOne({ _id: pending._id })

  try {
    await emailQueue.add('welcome', { email: user.email, displayName: user.displayName })
  } catch (err) {
    logger.error(`Khong the day job email chao mung: ${err.message}`)
  }

  // Tái dùng đúng hàm issueTokens đang dùng cho register/login
  return issueTokens(user)
}

// Gui lai OTP dang ky
const resendRegisterOtp = async ({ email }) => {
  const existing = await userModel.findOne({ email })
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const otp = crypto.randomInt(100000, 1000000).toString()
  const now = Date.now()

  const updated = await pendingRegistrationModel.findOneAndUpdate(
    {
      email,
      expiresAt: { $gt: new Date() },
      $or: [
        { lastSentAt: { $exists: false } },
        { lastSentAt: { $lte: new Date(now - REGISTER_RESEND_COOLDOWN_MS) } }
      ],
      sendCount: { $lt: REGISTER_MAX_RESENDS }
    },
    {
      $set: {
        otpHash: hashToken(otp),
        expiresAt: new Date(now + REGISTER_OTP_TTL_MS),
        lastSentAt: new Date(now),
        attemptCount: 0
      },
      $inc: { sendCount: 1 }
    },
    { new: true }
  )

  if (!updated) {
    const pending = await pendingRegistrationModel.findOne({ email })
    if (!pending) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Khong co yeu cau dang ky dang cho xac thuc.')
    }
    if (pending.sendCount >= REGISTER_MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui lai OTP qua nhieu lan. Vui long dang ky lai.')
    }
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
  }

  try {
    await pushRegisterOtpEmail({ email, displayName: updated.displayName, otp })
  } catch (err) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }

  return { email, expiresIn: REGISTER_OTP_TTL_MS / 1000 }
}

export default {
  login,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  resendForgotPasswordOtp,
  googleLogin,
  requestRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp
}
