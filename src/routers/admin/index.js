import { Router } from 'express'
import analyticsRouter from './analytics.route.js'

const adminRouter = Router()

adminRouter.use('/analytics', analyticsRouter)

export default adminRouter
