import { Router } from 'express'
import userRouter from './user.route.js'
import authRouter from './auth.route.js'

const clientRouter = Router()

clientRouter.use('/users', userRouter)
clientRouter.use('/auth', authRouter)

export default clientRouter
