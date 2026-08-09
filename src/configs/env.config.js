import dotenv from 'dotenv'

import { ENV_DEFAULTS, NUMBER_PARSE_RADIX } from '../constants/index.js'
dotenv.config()

const validateProductionEnv = (source = process.env) => {
  if (source.NODE_ENV !== 'production') return

  const required = [
    'JWT_SECRET_LOGIN',
    'JWT_SECRET_REFRESH',
    'JWT_EXPIRESIN_LOGIN',
    'JWT_EXPIRESIN_REFRESH',
    'OTP_PEPPER',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL'
  ]
  const missing = required.filter((key) => !source[key]?.trim())

  if (!source.MONGO_URI?.trim() && (!source.MONGO_USERNAME?.trim() || !source.MONGO_PASSWORD?.trim())) {
    missing.push('MONGO_URI or MONGO_USERNAME + MONGO_PASSWORD')
  }

  if (!source.REDIS_URL?.trim() && !source.REDIS_HOST?.trim()) {
    missing.push('REDIS_URL or REDIS_HOST')
  }

  if (!source.EMAIL_SMTP_USER?.trim() && !source.EMAIL_USER?.trim()) {
    missing.push('EMAIL_SMTP_USER or EMAIL_USER')
  }

  if (!source.EMAIL_SMTP_PASS?.trim() && !source.EMAIL_PASS?.trim()) {
    missing.push('EMAIL_SMTP_PASS or EMAIL_PASS')
  }

  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(', ')}`)
  }

  for (const key of ['JWT_SECRET_LOGIN', 'JWT_SECRET_REFRESH', 'OTP_PEPPER']) {
    if (source[key].length < 32) {
      throw new Error(`${key} must contain at least 32 characters in production.`)
    }
  }
}

validateProductionEnv()

const buildMongoUri = () => {
  if (process.env.MONGO_URI) return process.env.MONGO_URI

  const username = process.env.MONGO_USERNAME
  const password = process.env.MONGO_PASSWORD
  if (!username || !password) return ENV_DEFAULTS.MONGO_URI

  const host = process.env.MONGO_HOST || 'mongo'
  const port = parseInt(process.env.MONGO_PORT, NUMBER_PARSE_RADIX) || 27017
  const database = process.env.MONGO_DATABASE || 'hitproduct'

  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?authSource=admin`
}

const env = {
  server: {
    nodeEnv: process.env.NODE_ENV || ENV_DEFAULTS.NODE_ENV,
    host: process.env.HOST || ENV_DEFAULTS.HOST,
    port: process.env.PORT || ENV_DEFAULTS.PORT,
    clientUrl: process.env.CLIENT_URL || ENV_DEFAULTS.CLIENT_URL
  },
  bcrypt: {
    saltRounds: parseInt(process.env.SALT_ROUNDS, NUMBER_PARSE_RADIX) || ENV_DEFAULTS.BCRYPT_SALT_ROUNDS
  },
  jwt: {
    secretLogin: process.env.JWT_SECRET_LOGIN,
    secretOtp: process.env.JWT_SECRET_OTP,
    expiresInOtp: process.env.JWT_EXPIRESIN_OTP,
    expiresInLogin: process.env.JWT_EXPIRESIN_LOGIN,
    secretRefresh: process.env.JWT_SECRET_REFRESH,
    expiresInRefresh: process.env.JWT_EXPIRESIN_REFRESH
  },
  otp: {
    pepper: process.env.OTP_PEPPER
  },
  email: {
    user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASS,
    host: process.env.EMAIL_SMTP_HOST || 'smtp.titan.email',
    port: parseInt(process.env.EMAIL_SMTP_PORT, NUMBER_PARSE_RADIX) || 465,
    secure: process.env.EMAIL_SMTP_SECURE !== 'false'
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, NUMBER_PARSE_RADIX) || ENV_DEFAULTS.REDIS_PORT,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET
  },
  livekit: {
    url: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET
  },
  mongo: {
    uri: buildMongoUri()
  }
}

export { validateProductionEnv }
export default env
