import { Router } from 'express'

import { quizController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { quizValidation } from '../../validations/client/index.js'

const quizRouter = Router({ mergeParams: true })

quizRouter.use(authMiddleware)

quizRouter.post('/', validateMiddleware(quizValidation.generate), quizController.generate)
quizRouter.post('/submit', validateMiddleware(quizValidation.submit), quizController.submit)

export default quizRouter
