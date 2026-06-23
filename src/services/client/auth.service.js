import bcrypt from 'bcrypt'
import { StatusCodes } from 'http-status-codes'

import { userModel, sessionModel } from '../../models/index.js'
import { emailQueue } from '../../queues/index.js'
import { ApiError, hashToken, jwtUtils, logger } from '../../utils/index.js'
import { envConfig } from '../../configs/index.js'

const issueTokens = async (user) => {
  const accessToken = jwtUtils.generateAccessToken(user)
  const refreshToken = jwtUtils.generateRefreshToken(user)

  const { exp } = jwtUtils.decodeToken(refreshToken)

  await sessionModel.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(exp * 1000)
  })

  return { accessToken, refreshToken }
}

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

const refreshToken = async (token) => {
  let payload
  try {
    payload = jwtUtils.verifyRefreshToken(token)
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'refreshToken không hợp lệ hoặc đã hết hạn.')
  }

  const session = await sessionModel.findOne({ tokenHash: hashToken(token) })
  if (!session) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Phiên đăng nhập không tồn tại.')
  }

  const user = await userModel.findById(payload._id)
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Người dùng không tồn tại.')
  }

  const accessToken = jwtUtils.generateAccessToken(user)
  const newRefreshToken = jwtUtils.generateRefreshToken(user)
  const { exp } = jwtUtils.decodeToken(newRefreshToken)

  session.tokenHash = hashToken(newRefreshToken)
  session.expiresAt = new Date(exp * 1000)
  await session.save()

  return { accessToken, refreshToken: newRefreshToken }
}

const logout = async (token) => {
  await sessionModel.deleteOne({ tokenHash: hashToken(token) })
}

const logoutAll = async (userId) => {
  await sessionModel.deleteMany({ userId })
}

export default { register, login, refreshToken, logout, logoutAll }
