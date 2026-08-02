import { Router } from 'express'

import { dashboardController } from '../../controllers/client/index.js'
import { authMiddleware } from '../../middlewares/index.js'

const dashboardRouter = Router()

dashboardRouter.use(authMiddleware)

dashboardRouter.get('/', dashboardController.getOverview)

export default dashboardRouter