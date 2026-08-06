import Joi from 'joi'

import { SOCIAL_LIMITS } from '../../constants/index.js'

const objectId = Joi.string().hex().length(24)

const pagination = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(SOCIAL_LIMITS.PAGE_DEFAULT),
    limit: Joi.number().integer().min(1).max(SOCIAL_LIMITS.PAGE_LIMIT_MAX).default(SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT)
  })
}

const sendRequest = {
  body: Joi.object({
    userId: objectId.required()
  })
}

const requestId = {
  params: Joi.object({
    id: objectId.required()
  })
}

const friendshipId = {
  params: Joi.object({
    id: objectId.required()
  })
}

export default {
  sendRequest,
  requestId,
  friendshipId,
  pagination
}
