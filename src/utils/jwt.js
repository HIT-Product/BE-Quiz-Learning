import jwt from 'jsonwebtoken'
import { envConfig } from '../configs/index.js'

const extractToken = (req) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.split(' ')[1] || null
}

const generateAccessToken = (user) => {
  return jwt.sign({ _id: user._id, email: user.email }, envConfig.jwt.secretLogin, {
    expiresIn: envConfig.jwt.expiresInLogin
  })
}

const generateRefreshToken = (user) => {
  return jwt.sign({ _id: user._id }, envConfig.jwt.secretRefresh, { expiresIn: envConfig.jwt.expiresInRefresh })
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, envConfig.jwt.secretLogin)
}

const verifyRefreshToken = (token) => {
  return jwt.verify(token, envConfig.jwt.secretRefresh)
}

// Không verify, chỉ đọc payload để lấy exp khi lưu Session
const decodeToken = (token) => {
  return jwt.decode(token)
}

export default {
  extractToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken
}
