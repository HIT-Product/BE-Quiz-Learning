import { Router } from 'express'

import { folderController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { folderValidation } from '../../validations/client/index.js'

const folderRouter = Router()

folderRouter.use(authMiddleware)

folderRouter.get('/', folderController.list)
folderRouter.post('/', validateMiddleware(folderValidation.create), folderController.create)
folderRouter.get('/:id', folderController.getById)
folderRouter.put('/:id', validateMiddleware(folderValidation.update), folderController.update)
folderRouter.delete('/:id', folderController.remove)

export default folderRouter
