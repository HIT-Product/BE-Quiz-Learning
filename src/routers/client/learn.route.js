import { Router } from 'express'

import { learnController, learnSessionController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { learnValidation, learnSessionValidation } from '../../validations/client/index.js'

const learnRouter = Router({ mergeParams: true })

learnRouter.use(authMiddleware)

learnRouter.get('/', validateMiddleware(learnValidation.round), learnController.round)
learnRouter.post('/answer', validateMiddleware(learnValidation.answer), learnController.answer)

learnRouter.post('/session', validateMiddleware(learnSessionValidation.start), learnSessionController.start)
learnRouter.get('/session', validateMiddleware(learnSessionValidation.current), learnSessionController.current)
learnRouter.post('/session/answer', validateMiddleware(learnSessionValidation.answer), learnSessionController.answer)
learnRouter.post('/session/override', validateMiddleware(learnSessionValidation.override), learnSessionController.override)
learnRouter.post('/session/reset', validateMiddleware(learnSessionValidation.reset), learnSessionController.reset)

export default learnRouter
