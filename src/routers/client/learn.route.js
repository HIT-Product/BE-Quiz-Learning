import { Router } from 'express'

import { learnController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { learnValidation } from '../../validations/client/index.js'

const learnRouter = Router({ mergeParams: true })

learnRouter.use(authMiddleware)

learnRouter.get('/', validateMiddleware(learnValidation.round), learnController.round)
learnRouter.post('/answer', validateMiddleware(learnValidation.answer), learnController.answer)

export default learnRouter
