import { Router } from 'express'

import { userController } from '../../controllers/client/index.js'
import { userValidation } from '../../validations/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'

const userRouter = Router()

userRouter.use(authMiddleware)
userRouter.get('/me', userController.getMe)
userRouter.put('/me', validateMiddleware(userValidation.updateProfile), userController.updateMe)

export default userRouter
