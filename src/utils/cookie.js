import { COOKIE_MAX_AGE, COOKIE_PATH, COOKIE_SAME_SITE } from '../constants/index.js'
import { envConfig } from '../configs/index.js'

const refreshCookieOptions = {
  httpOnly: true,
  secure: envConfig.server.nodeEnv === 'production',
  sameSite: envConfig.server.nodeEnv === 'production' ? COOKIE_SAME_SITE.PRODUCTION : COOKIE_SAME_SITE.DEVELOPMENT,
  maxAge: COOKIE_MAX_AGE.REFRESH_TOKEN,
  path: COOKIE_PATH.AUTH
}

export default refreshCookieOptions
