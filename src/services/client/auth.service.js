import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import crypto from 'node:crypto'
import { StatusCodes } from 'http-status-codes'

import { envConfig } from '../../configs/index.js'
import { AUTH_LIMITS, EMAIL_JOB_NAME, GOOGLE_AUTH, USER_ROLE } from '../../constants/index.js'
import { emailQueue } from '../../queues/index.js'
import { ApiError, hashToken, jwtUtils, logger } from '../../utils/index.js'
import { userModel, sessionModel, passwordResetModel, pendingRegistrationModel } from '../../models/index.js'

// Tạo token và phiên đăng nhập

const issueTokens = async (user) => {
  const session = new sessionModel({ userId: user._id })

  const accessToken = jwtUtils.generateAccessToken(user, session._id)
  const refreshToken = jwtUtils.generateRefreshToken(user, session._id)
  const { exp } = jwtUtils.decodeToken(refreshToken)

  session.tokenHash = hashToken(refreshToken)
  session.expiresAt = new Date(exp * AUTH_LIMITS.JWT_EXP_SECONDS_TO_MS)
  await session.save()

  return { accessToken, refreshToken }
}

// Đăng nhập
const login = async ({ email, password, scope }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Email hoặc mật khẩu không đúng.')
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Email hoặc mật khẩu không đúng.')
  }

  if (scope === 'admin' && user.role !== USER_ROLE.ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Tài khoản này không có quyền quản trị.')
  }

  return issueTokens(user)
}

// Làm mới refresh token
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

  const currentSession = {
    _id: payload.sessionId,
    userId: payload._id,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() }
  }

  const user = await userModel.findById(payload._id)
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Người dùng không tồn tại.')
  }

  const newRefreshToken = jwtUtils.generateRefreshToken(user, payload.sessionId)
  const { exp } = jwtUtils.decodeToken(newRefreshToken)
  const rotated = await sessionModel.updateOne(currentSession, {
    $set: { tokenHash: hashToken(newRefreshToken), expiresAt: new Date(exp * AUTH_LIMITS.JWT_EXP_SECONDS_TO_MS) }
  })
  if (!rotated.matchedCount) throw new ApiError(StatusCodes.UNAUTHORIZED, 'Phiên đăng nhập không tồn tại.')

  return { accessToken: jwtUtils.generateAccessToken(user, payload.sessionId), refreshToken: newRefreshToken }
}

// Đăng xuất
const logout = async (token) => {
  await sessionModel.deleteOne({ tokenHash: hashToken(token) })
}

// Đăng xuất tất cả thiết bị
const logoutAll = async (userId) => {
  await sessionModel.deleteMany({ userId })
}

// Đổi mật khẩu
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

// Gửi OTP quên mật khẩu
const requireEmailDelivery = () => {
  if (!envConfig.email.enabled) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Dịch vụ gửi email hiện chưa khả dụng.')
  }
}

const forgotPassword = async ({ email }) => {
  requireEmailDelivery()
  const user = await userModel.findOne({ email })
  if (!user) return

  const existing = await passwordResetModel.findOne({ userId: user._id })

  if (existing && existing.expiresAt > new Date()) {
    if (existing.lastSentAt && Date.now() - existing.lastSentAt.getTime() < AUTH_LIMITS.RESEND_COOLDOWN_MS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
    }
    if (existing.sendCount >= AUTH_LIMITS.MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui OTP qua nhieu lan. Vui long thu lai sau.')
    }
  }

  const otp = crypto.randomInt(AUTH_LIMITS.OTP_MIN, AUTH_LIMITS.OTP_MAX).toString()

  const update = {
    $set: {
      otpHash: hashToken(otp),
      expiresAt: new Date(Date.now() + AUTH_LIMITS.FORGOT_PASSWORD_OTP_TTL_MS),
      lastSentAt: new Date(),
      attemptCount: 0
    }
  }

  if (existing) {
    update.$inc = { sendCount: 1 }
  } else {
    update.$setOnInsert = { sendCount: 1 }
  }

  await passwordResetModel.findOneAndUpdate({ userId: user._id }, update, { upsert: true })

  try {
    await emailQueue.add(EMAIL_JOB_NAME.RESET_PASSWORD, {
      email: user.email,
      displayName: user.displayName,
      otp
    })
  } catch (err) {
    logger.error(`Khong the day job email quen mat khau: ${err.message}`)
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }
}

const invalidOtp = () => new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')

const validOtpRecord = (record) => ({
  _id: record._id,
  otpHash: record.otpHash,
  expiresAt: { $eq: record.expiresAt, $gt: new Date() },
  attemptCount: { $lt: AUTH_LIMITS.MAX_VERIFY_ATTEMPTS }
})

const verifyOtp = async (model, record, otp) => {
  if (!record || record.expiresAt <= new Date() || record.attemptCount >= AUTH_LIMITS.MAX_VERIFY_ATTEMPTS) {
    throw invalidOtp()
  }
  if (record.otpHash !== hashToken(otp)) {
    await model.updateOne(validOtpRecord(record), { $inc: { attemptCount: 1 } })
    throw invalidOtp()
  }
}

// Đặt lại mật khẩu bằng OTP
const resetPassword = async ({ email, otp, newPassword }) => {
  const user = await userModel.findOne({ email })
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP khong hop le hoac da het han.')
  }

  const record = await passwordResetModel.findOne({ userId: user._id })
  await verifyOtp(passwordResetModel, record, otp)

  if (user.passwordHash) {
    const isSame = await bcrypt.compare(newPassword, user.passwordHash)
    if (isSame) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Mat khau moi khong duoc trung voi mat khau cu.')
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, envConfig.bcrypt.saltRounds)
  const consumed = await passwordResetModel.findOneAndDelete(validOtpRecord(record))
  if (!consumed) throw invalidOtp()
  user.passwordHash = passwordHash
  await user.save()
  await sessionModel.deleteMany({ userId: user._id })
}

// Gửi lại OTP quên mật khẩu
const resendForgotPasswordOtp = async ({ email }) => {
  requireEmailDelivery()
  const user = await userModel.findOne({ email })
  if (!user) return

  const otp = crypto.randomInt(AUTH_LIMITS.OTP_MIN, AUTH_LIMITS.OTP_MAX).toString()
  const now = Date.now()

  const updated = await passwordResetModel.findOneAndUpdate(
    {
      userId: user._id,
      expiresAt: { $gt: new Date() },
      $or: [
        { lastSentAt: { $exists: false } },
        { lastSentAt: { $lte: new Date(now - AUTH_LIMITS.RESEND_COOLDOWN_MS) } }
      ],
      sendCount: { $lt: AUTH_LIMITS.MAX_RESENDS }
    },
    {
      $set: {
        otpHash: hashToken(otp),
        expiresAt: new Date(now + AUTH_LIMITS.FORGOT_PASSWORD_OTP_TTL_MS),
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
    if (record.sendCount >= AUTH_LIMITS.MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui lai OTP qua nhieu lan. Vui long thu lai sau.')
    }
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
  }

  try {
    await emailQueue.add(EMAIL_JOB_NAME.RESET_PASSWORD, {
      email: user.email,
      displayName: user.displayName,
      otp
    })
  } catch (err) {
    logger.error(`Khong the day job email resend OTP: ${err.message}`)
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }
}

// Tạo mật khẩu Google
const generateGooglePassword = () => {
  return (
    GOOGLE_AUTH.PASSWORD_PREFIX +
    crypto.randomBytes(GOOGLE_AUTH.PASSWORD_RANDOM_BYTES).toString(GOOGLE_AUTH.RANDOM_ENCODING) +
    GOOGLE_AUTH.PASSWORD_SEPARATOR +
    Date.now()
  )
}

// Đăng nhập Google
const googleLogin = async (profile) => {
  if (!profile) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Xác thực Google thất bại.')
  }

  const rawEmail = profile.emails?.find(({ verified }) => verified === true)?.value

  if (!rawEmail?.trim()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Tài khoản Google chưa xác minh email.')
  }

  const email = rawEmail.trim().toLowerCase()
  const displayName = profile.displayName?.trim() || email.split(GOOGLE_AUTH.PROFILE_EMAIL_SEPARATOR)[0]
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
      if (envConfig.email.enabled) {
        await emailQueue.add(EMAIL_JOB_NAME.WELCOME, { email: user.email, displayName: user.displayName })
      }
    } catch (err) {
      logger.error(`Khong the day job email chao mung: ${err.message}`)
    }
  }

  return issueTokens(user)
}

const pushRegisterOtpEmail = async ({ email, displayName, otp }) => {
  try {
    await emailQueue.add(EMAIL_JOB_NAME.REGISTER_OTP, { email, displayName, otp })
  } catch (err) {
    logger.error(`Khong the day job email OTP dang ky: ${err.message}`)
  }
}

const requestRegisterOtp = async ({ email, password, displayName }) => {
  requireEmailDelivery()
  const existing = await userModel.findOne({ email })
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const pending = await pendingRegistrationModel.findOne({ email })

  // Pending còn hiệu lực thì vẫn áp dụng cooldown và giới hạn gửi
  if (pending && pending.expiresAt > new Date()) {
    if (pending.lastSentAt && Date.now() - pending.lastSentAt.getTime() < AUTH_LIMITS.RESEND_COOLDOWN_MS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
    }
    if (pending.sendCount >= AUTH_LIMITS.MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui OTP qua nhieu lan. Vui long dang ky lai sau.')
    }
  }

  const passwordHash = await bcrypt.hash(password, envConfig.bcrypt.saltRounds)
  const otp = crypto.randomInt(AUTH_LIMITS.OTP_MIN, AUTH_LIMITS.OTP_MAX).toString()

  const update = {
    $set: {
      passwordHash,
      displayName,
      otpHash: hashToken(otp),
      expiresAt: new Date(Date.now() + AUTH_LIMITS.REGISTER_OTP_TTL_MS),
      lastSentAt: new Date(),
      attemptCount: 0
    }
  }

  if (pending) {
    update.$inc = { sendCount: 1 }
  } else {
    update.$setOnInsert = { sendCount: 1 }
  }

  await pendingRegistrationModel.findOneAndUpdate({ email }, update, { upsert: true, new: true })

  try {
    await pushRegisterOtpEmail({ email, displayName, otp })
  } catch (err) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }

  return { email, expiresIn: AUTH_LIMITS.REGISTER_OTP_EXPIRES_IN_SECONDS }
}

// Xác thực OTP và tạo tài khoản
const verifyRegisterOtp = async ({ email, otp }) => {
  const pending = await pendingRegistrationModel.findOne({ email })
  await verifyOtp(pendingRegistrationModel, pending, otp)

  // Chống race: email có thể vừa được tạo bởi luồng khác giữa lúc gửi và xác thực
  const existing = await userModel.findOne({ email })
  if (existing) {
    await pendingRegistrationModel.deleteOne(validOtpRecord(pending))
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const consumed = await pendingRegistrationModel.findOneAndDelete(validOtpRecord(pending))
  if (!consumed) throw invalidOtp()

  // Tạo user thật từ thông tin đã lưu
  const user = await userModel.create({
    email: consumed.email,
    passwordHash: consumed.passwordHash,
    displayName: consumed.displayName
  })

  try {
    if (envConfig.email.enabled) {
      await emailQueue.add(EMAIL_JOB_NAME.WELCOME, { email: user.email, displayName: user.displayName })
    }
  } catch (err) {
    logger.error(`Khong the day job email chao mung: ${err.message}`)
  }

  // Tái dùng đúng hàm issueTokens đang dùng cho register/login
  return issueTokens(user)
}

// Gửi lại OTP đăng ký
const resendRegisterOtp = async ({ email }) => {
  requireEmailDelivery()
  const existing = await userModel.findOne({ email })
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email đã tồn tại.')
  }

  const otp = crypto.randomInt(AUTH_LIMITS.OTP_MIN, AUTH_LIMITS.OTP_MAX).toString()
  const now = Date.now()

  const updated = await pendingRegistrationModel.findOneAndUpdate(
    {
      email,
      expiresAt: { $gt: new Date() },
      $or: [
        { lastSentAt: { $exists: false } },
        { lastSentAt: { $lte: new Date(now - AUTH_LIMITS.RESEND_COOLDOWN_MS) } }
      ],
      sendCount: { $lt: AUTH_LIMITS.MAX_RESENDS }
    },
    {
      $set: {
        otpHash: hashToken(otp),
        expiresAt: new Date(now + AUTH_LIMITS.REGISTER_OTP_TTL_MS),
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
    if (pending.sendCount >= AUTH_LIMITS.MAX_RESENDS) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da gui lai OTP qua nhieu lan. Vui long dang ky lai.')
    }
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Vui long doi truoc khi gui lai OTP.')
  }

  try {
    await pushRegisterOtpEmail({ email, displayName: updated.displayName, otp })
  } catch (err) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Khong the gui email. Vui long thu lai.')
  }

  return { email, expiresIn: AUTH_LIMITS.REGISTER_OTP_EXPIRES_IN_SECONDS }
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
