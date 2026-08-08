import { Router } from 'express'

import { studyRoomController } from '../../controllers/client/index.js'
import { validateMiddleware, authMiddleware, rateLimitMiddleware } from '../../middlewares/index.js'
import { studyRoomValidation } from '../../validations/client/index.js'

const studyRoomRouter = Router()

const createRoomRateLimit = rateLimitMiddleware({
  keyPrefix: 'study-room:create',
  max: 10,
  windowSec: 60 * 60,
  message: 'Ban tao phong qua nhanh. Hay thu lai sau.'
})

const joinRoomRateLimit = rateLimitMiddleware({
  keyPrefix: 'study-room:join',
  max: 10,
  windowSec: 60,
  message: 'Ban thu ma phong qua nhanh. Hay thu lai sau.'
})

studyRoomRouter.use(authMiddleware)

studyRoomRouter.get('/', validateMiddleware(studyRoomValidation.list), studyRoomController.list)
studyRoomRouter.post(
  '/',
  createRoomRateLimit,
  validateMiddleware(studyRoomValidation.create),
  studyRoomController.create
)
studyRoomRouter.post(
  '/join',
  joinRoomRateLimit,
  validateMiddleware(studyRoomValidation.joinByCode),
  studyRoomController.joinByCode
)
studyRoomRouter.get('/:id', validateMiddleware(studyRoomValidation.roomIdParam), studyRoomController.getById)
studyRoomRouter.get(
  '/:id/messages',
  validateMiddleware(studyRoomValidation.listMessages),
  studyRoomController.listMessages
)
studyRoomRouter.get(
  '/:id/leaderboard',
  validateMiddleware(studyRoomValidation.roomIdParam),
  studyRoomController.leaderboard
)
studyRoomRouter.post(
  '/:id/media-token',
  validateMiddleware(studyRoomValidation.roomIdParam),
  studyRoomController.mediaToken
)
studyRoomRouter.patch('/:id/close', validateMiddleware(studyRoomValidation.roomIdParam), studyRoomController.close)

export default studyRoomRouter
