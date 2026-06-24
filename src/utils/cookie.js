import { envConfig } from '../configs/index.js'

const refreshCookieOptions = {
  httpOnly: true,
  secure: envConfig.server.nodeEnv === 'production',
  sameSite: envConfig.server.nodeEnv === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth'
}

export default refreshCookieOptions
