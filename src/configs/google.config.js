import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

import envConfig from './env.config.js'

const googleConfig = {
  clientID: envConfig.google.clientId,
  clientSecret: envConfig.google.clientSecret,
  callbackURL: envConfig.google.callbackUrl
}

const missingGoogleConfig = Object.entries(googleConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingGoogleConfig.length > 0) {
  throw new Error(`Thiếu cấu hình Google OAuth: ${missingGoogleConfig.join(', ')}`)
}

passport.use(new GoogleStrategy(googleConfig, (_accessToken, _refreshToken, profile, done) => done(null, profile)))

export default passport
