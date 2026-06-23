import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

import envConfig from './env.config.js'
import authService from '../services/client/auth.service.js'

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

passport.use(
  new GoogleStrategy(
    googleConfig,
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const tokens = await authService.googleLogin(profile)
        return done(null, tokens)
      } catch (error) {
        return done(error)
      }
    }
  )
)

export default passport
