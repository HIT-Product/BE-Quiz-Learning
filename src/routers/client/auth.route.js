import { Router } from 'express'

import { passport } from '../../configs/index.js'
import { authValidation } from '../../validations/client/index.js'
import { authController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'

const authRouter = Router()

// === Chức năng: Đăng ký và đăng nhập bằng email ===
authRouter.post('/register', validateMiddleware(authValidation.register), authController.register)
authRouter.post('/login', validateMiddleware(authValidation.login), authController.login)

// === Chức năng: Quản lý phiên đăng nhập và token ===
authRouter.post('/refresh-token', authController.refreshToken)
authRouter.post('/logout', authController.logout)
authRouter.post('/logout-all', authMiddleware, authController.logoutAll)

// === Chức năng: Đổi mật khẩu khi đang đăng nhập ===
authRouter.post(
  '/change-password',
  authMiddleware,
  validateMiddleware(authValidation.changePassword),
  authController.changePassword
)
// === Chức năng: Khôi phục mật khẩu bằng OTP ===
authRouter.post('/forgot-password', validateMiddleware(authValidation.forgotPassword), authController.forgotPassword)
authRouter.post('/reset-password', validateMiddleware(authValidation.resetPassword), authController.resetPassword)

authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }))

const googleCallbackHandlers = [passport.authenticate('google', { session: false }), authController.googleCallback]

authRouter.get('/google-callback', ...googleCallbackHandlers)

export default authRouter
