import { Router } from 'express'

import { friendController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware } from '../../middlewares/index.js'
import { friendValidation } from '../../validations/client/index.js'

const friendRouter = Router()

friendRouter.use(authMiddleware)

friendRouter.get('/', validateMiddleware(friendValidation.pagination), friendController.listFriends)
friendRouter.get('/requests', validateMiddleware(friendValidation.pagination), friendController.listPendingRequests)
friendRouter.get('/presence', friendController.getFriendsPresence)

friendRouter.post('/requests', validateMiddleware(friendValidation.sendRequest), friendController.sendRequest)
friendRouter.post(
  '/requests/:id/accept',
  validateMiddleware(friendValidation.requestId),
  friendController.acceptRequest
)
friendRouter.post(
  '/requests/:id/decline',
  validateMiddleware(friendValidation.requestId),
  friendController.declineRequest
)

friendRouter.delete(
  '/requests/:id',
  validateMiddleware(friendValidation.requestId),
  friendController.cancelRequest
)
friendRouter.delete('/:id', validateMiddleware(friendValidation.friendshipId), friendController.unfriend)

export default friendRouter
