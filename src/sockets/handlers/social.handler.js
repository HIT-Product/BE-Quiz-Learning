import Joi from 'joi'

import { PRESENCE_STATUS, SOCIAL_SOCKET_EVENT } from '../../constants/index.js'
import { presenceService } from '../../services/client/index.js'
import { logger } from '../../utils/index.js'
import { safeHandler, socketError } from '../utils/socketHandler.js'

const heartbeatSchema = Joi.object({
  status: Joi.string()
    .valid(PRESENCE_STATUS.ONLINE, PRESENCE_STATUS.IDLE)
    .default(PRESENCE_STATUS.ONLINE)
})

const validate = (schema, payload) => {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true })
  if (error) throw socketError('INVALID_PAYLOAD', 'Du lieu khong hop le.')
  return value
}

const registerSocialHandlers = (nsp, socket) => {
  const userId = String(socket.user._id)
  const socketId = socket.id

  presenceService.setConnection(userId, socketId, PRESENCE_STATUS.ONLINE).catch((err) => {
    logger.warn(`Presence set failed on connect: ${err.message}`)
  })

  socket.on(
    SOCIAL_SOCKET_EVENT.PRESENCE_HEARTBEAT,
    safeHandler(async (payload) => {
      const { status } = validate(heartbeatSchema, payload)
      await presenceService.heartbeat(userId, socketId, status)
      return { status }
    })
  )

  socket.on('disconnect', () => {
    presenceService.clearConnection(userId, socketId).catch((err) => {
      logger.warn(`Presence clear failed on disconnect: ${err.message}`)
    })
  })
}

export default registerSocialHandlers
