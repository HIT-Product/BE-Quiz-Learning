import { Router } from 'express'

import { flashcardController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { flashcardValidation } from '../../validations/client/index.js'

const flashcardRouter = Router({ mergeParams: true })

flashcardRouter.use(authMiddleware)

flashcardRouter.get('/', flashcardController.list)
flashcardRouter.post('/', validateMiddleware(flashcardValidation.create), flashcardController.create)
flashcardRouter.put('/reorder', validateMiddleware(flashcardValidation.reorder), flashcardController.reorder)
flashcardRouter.put('/:cardId', validateMiddleware(flashcardValidation.update), flashcardController.update)
flashcardRouter.delete('/:cardId', flashcardController.remove)

export default flashcardRouter
