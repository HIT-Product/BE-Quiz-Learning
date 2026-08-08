import { Router } from 'express'

import { feedController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { feedValidation } from '../../validations/client/index.js'

const feedRouter = Router()

feedRouter.use(authMiddleware)

feedRouter.get('/', validateMiddleware(feedValidation.pagination), feedController.getFeed)

export default feedRouter
