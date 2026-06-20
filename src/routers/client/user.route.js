import { Router } from 'express'
import { userController } from '../../controllers/client/index.js'

const userRouter = Router()

userRouter.get('/example', userController.example)

export default userRouter
