import { Router } from 'express'

import { passport } from '../../configs/index.js'
import { authValidation } from '../../validations/client/index.js'
import { authController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'

const authRouter = Router()

// Dang ky bang OTP: gui thong tin, xac thuc ma roi moi tao account
authRouter.post('/register', validateMiddleware(authValidation.requestRegisterOtp), authController.requestRegisterOtp)
authRouter.post('/register/verify-otp', validateMiddleware(authValidation.verifyRegisterOtp), authController.verifyRegisterOtp)
authRouter.post('/register/resend-otp', validateMiddleware(authValidation.resendRegisterOtp), authController.resendRegisterOtp)
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

authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

const googleCallbackHandlers = [passport.authenticate('google', { session: false }), authController.googleCallback]

authRouter.get('/google-callback', ...googleCallbackHandlers)


export default authRouter
