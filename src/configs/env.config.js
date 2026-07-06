import dotenv from 'dotenv'

import { ENV_DEFAULTS, NUMBER_PARSE_RADIX } from '../constants/index.js'
dotenv.config()

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
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  redis: {
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
    cloudName: process.env.CLOUD_NAME,
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET
  },
  mongo: {
    uri: process.env.MONGO_URI || ENV_DEFAULTS.MONGO_URI
  }
}

export default env
