import Joi from 'joi'

import { SOCIAL_LIMITS } from '../../constants/index.js'

const objectId = Joi.string().hex().length(24)

const sendMessage = {
  body: Joi.object({
    recipientId: objectId.required(),
    clientMessageId: Joi.string().trim().max(SOCIAL_LIMITS.CLIENT_MESSAGE_ID_MAX).required(),
    body: Joi.string().trim().min(1).max(SOCIAL_LIMITS.DM_BODY_MAX).required()
  })
}

const listMessages = {
  params: Joi.object({
    id: objectId.required()
  }),
  query: Joi.object({
    before: objectId,
    limit: Joi.number().integer().min(1).max(50).default(30)
  })
}

const conversationId = {
  params: Joi.object({
    id: objectId.required()
  })
}

const pagination = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(SOCIAL_LIMITS.PAGE_DEFAULT),
    limit: Joi.number().integer().min(1).max(SOCIAL_LIMITS.PAGE_LIMIT_MAX).default(SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT)
  })
}

export default { sendMessage, listMessages, conversationId, pagination }
