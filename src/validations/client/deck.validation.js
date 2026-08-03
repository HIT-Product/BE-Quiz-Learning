import Joi from 'joi'

import { DECK_LIMITS, DECK_VISIBILITIES, DECK_VISIBILITY } from '../../constants/index.js'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const create = {
  body: Joi.object({
    title: Joi.string().trim().max(DECK_LIMITS.TITLE_MAX_LENGTH).required(),
    description: Joi.string().allow('').default(''),
    visibility: Joi.string()
      .valid(...DECK_VISIBILITIES)
      .default(DECK_VISIBILITY.PRIVATE),
    folderId: objectId.allow(null)
  })
}

const update = {
  body: Joi.object({
    title: Joi.string().trim().max(DECK_LIMITS.TITLE_MAX_LENGTH),
    description: Joi.string().allow(''),
    visibility: Joi.string().valid(...DECK_VISIBILITIES),
    folderId: objectId.allow(null)
  }).min(1)
}

const list = {
  query: Joi.object({
    folderId: objectId
  })
}

const listPublic = {
  query: Joi.object({
    q: Joi.string().trim().max(100).optional(),
    sort: Joi.string().valid('newest', 'popular').default('newest'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  })
}

const getPublicById = {
  params: Joi.object({
    id: objectId.required()
  })
}

export default { create, update, list, listPublic, getPublicById }
