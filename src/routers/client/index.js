import { Router } from 'express'
import userRouter from './user.route.js'

const clientRouter = Router()

clientRouter.use('/users', userRouter)

export default clientRouter
