import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'

import { envConfig, passport } from '../../configs/index.js'
import { COOKIE_PATH, GOOGLE_AUTH } from '../../constants/index.js'
import { authValidation } from '../../validations/client/index.js'
import { authController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'

const authRouter = Router()

// Đăng ký bằng OTP: gửi thông tin, xác thực mã rồi mới tạo account
authRouter.post('/register', validateMiddleware(authValidation.requestRegisterOtp), authController.requestRegisterOtp)
authRouter.post(
  '/register/verify-otp',
  validateMiddleware(authValidation.verifyRegisterOtp),
  authController.verifyRegisterOtp
)
authRouter.post(
  '/register/resend-otp',
  validateMiddleware(authValidation.resendRegisterOtp),
  authController.resendRegisterOtp
)
authRouter.post('/login', validateMiddleware(authValidation.login), authController.login)

authRouter.post('/refresh-token', authController.refreshToken)
authRouter.post('/logout', authController.logout)
authRouter.post('/logout-all', authMiddleware, authController.logoutAll)

authRouter.post(
  '/change-password',
  authMiddleware,
  validateMiddleware(authValidation.changePassword),
  authController.changePassword
)
authRouter.post('/forgot-password', validateMiddleware(authValidation.forgotPassword), authController.forgotPassword)
authRouter.post(
  '/forgot-password/resend',
  validateMiddleware(authValidation.resendForgotPasswordOtp),
  authController.resendForgotPasswordOtp
)
authRouter.post('/reset-password', validateMiddleware(authValidation.resetPassword), authController.resetPassword)

const googleStateCookie = 'googleOAuthState'
const googleStateCookieOptions = {
  httpOnly: true,
  secure: envConfig.server.nodeEnv === 'production',
  sameSite: 'lax',
  path: COOKIE_PATH.AUTH
}

authRouter.get('/google', (req, res, next) => {
  const state = randomBytes(32).toString('hex')
  res.cookie(googleStateCookie, state, { ...googleStateCookieOptions, maxAge: 10 * 60 * 1000 })
  return passport.authenticate('google', {
    scope: GOOGLE_AUTH.GOOGLE_SCOPES,
    session: GOOGLE_AUTH.SESSION_DISABLED,
    state
  })(req, res, next)
})

const verifyGoogleState = (req, res, next) => {
  const state = req.query.state
  const expected = req.cookies[googleStateCookie]
  res.clearCookie(googleStateCookie, googleStateCookieOptions)
  const valid = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
  if (!valid(state) || !valid(expected) || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return res.redirect(envConfig.server.clientUrl + '/auth/login?success=false')
  }
  next()
}

const googleCallbackHandlers = [
  verifyGoogleState,
  passport.authenticate('google', {
    session: GOOGLE_AUTH.SESSION_DISABLED,
    failureRedirect: envConfig.server.clientUrl + '/auth/login?success=false'
  }),
  authController.googleCallback
]

authRouter.get('/google-callback', ...googleCallbackHandlers)

export default authRouter
