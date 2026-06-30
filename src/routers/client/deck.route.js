import { Router } from 'express'

import { deckController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { deckValidation } from '../../validations/client/index.js'
const deckRouter = Router()

deckRouter.use(authMiddleware)

deckRouter.get('/', validateMiddleware(deckValidation.list), deckController.list)
deckRouter.get('/public', validateMiddleware(deckValidation.listPublic), deckController.listPublic)
deckRouter.post('/', validateMiddleware(deckValidation.create), deckController.create)
deckRouter.get('/:id', deckController.getById)
deckRouter.put('/:id', validateMiddleware(deckValidation.update), deckController.update)
deckRouter.delete('/:id', deckController.remove)
deckRouter.post('/:id/copy', deckController.copy)

export default deckRouter
