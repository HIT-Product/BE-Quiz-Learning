import { Router } from 'express'
import { authController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { authValidation } from '../../validations/client/index.js'

const authRouter = Router()

authRouter.post('/register', validateMiddleware(authValidation.register), authController.register)
authRouter.post('/login', validateMiddleware(authValidation.login), authController.login)
authRouter.post('/refresh-token', authController.refreshToken)
authRouter.post('/logout', authController.logout)
authRouter.post('/logout-all', authMiddleware, authController.logoutAll)

export default authRouter
