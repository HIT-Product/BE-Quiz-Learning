import { Router } from 'express'

import { studyController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { studyValidation } from '../../validations/client/index.js'

const studyRouter = Router({ mergeParams: true })

studyRouter.use(authMiddleware)

studyRouter.get('/', studyController.startSession)
studyRouter.post('/cards/:cardId/review', validateMiddleware(studyValidation.review), studyController.reviewCard)

export default studyRouter
