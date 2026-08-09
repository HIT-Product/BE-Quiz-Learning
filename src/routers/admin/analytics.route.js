import { Router } from 'express'

import { analyticsController } from '../../controllers/admin/index.js'
import { adminMiddleware, authMiddleware, validateMiddleware } from '../../middlewares/index.js'
import { analyticsValidation } from '../../validations/admin/index.js'

const analyticsRouter = Router()

analyticsRouter.use(authMiddleware, adminMiddleware)
analyticsRouter.get('/', validateMiddleware(analyticsValidation.overview), analyticsController.getOverview)

export default analyticsRouter
