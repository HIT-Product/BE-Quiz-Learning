import dotenv from 'dotenv'
dotenv.config()

const env = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3000,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  },
  bcrypt: {
    saltRounds: parseInt(process.env.SALT_ROUNDS, 10) || 10
  },
  jwt: {
    secretLogin: process.env.JWT_SECRET_LOGIN,
    secretOtp: process.env.JWT_SECRET_OTP,
    expiresInOtp: process.env.JWT_EXPIRESIN_OTP,
    expiresInLogin: process.env.JWT_EXPIRESIN_LOGIN,
    secretRefresh: process.env.JWT_SECRET_REFRESH,
    expiresInRefresh: process.env.JWT_EXPIRESIN_REFRESH
  },
  email: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD
  },
  cloudinary: {
    cloudName: process.env.CLOUD_NAME,
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase'
  }
}

export default env
