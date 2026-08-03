import { Router } from 'express'

import { userController } from '../../controllers/client/index.js'
import { userValidation } from '../../validations/client/index.js'
import { validateMiddleware, authMiddleware, uploadAvatarMiddleware } from '../../middlewares/index.js'

const userRouter = Router()

userRouter.use(authMiddleware)
userRouter.get('/me', userController.getMe)
userRouter.put('/me', validateMiddleware(userValidation.updateProfile), userController.updateMe)
userRouter.post('/me/avatar', uploadAvatarMiddleware, userController.uploadAvatar)
userRouter.delete('/me/avatar', userController.removeAvatar)

export default userRouter
