import { Router } from 'express'

import { blockController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { blockValidation } from '../../validations/client/index.js'

const blockRouter = Router()

blockRouter.use(authMiddleware)

blockRouter.get('/', validateMiddleware(blockValidation.pagination), blockController.listBlocked)
blockRouter.post('/', validateMiddleware(blockValidation.blockUser), blockController.blockUser)
blockRouter.delete('/:id', validateMiddleware(blockValidation.targetId), blockController.unblockUser)

export default blockRouter
