import { Router } from 'express'

import { dmController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { dmValidation } from '../../validations/client/index.js'

const conversationRouter = Router()

conversationRouter.use(authMiddleware)

conversationRouter.get('/', validateMiddleware(dmValidation.pagination), dmController.listConversations)
conversationRouter.post('/messages', validateMiddleware(dmValidation.sendMessage), dmController.sendMessage)
conversationRouter.get('/:id/messages', validateMiddleware(dmValidation.listMessages), dmController.listMessages)
conversationRouter.post('/:id/read', validateMiddleware(dmValidation.conversationId), dmController.markRead)

export default conversationRouter
