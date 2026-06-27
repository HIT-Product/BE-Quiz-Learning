import Joi from 'joi'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const create = {
  body: Joi.object({
    title: Joi.string().trim().max(200).required(),
    description: Joi.string().allow('').default(''),
    visibility: Joi.string().valid('private', 'public').default('private'),
    folderId: objectId.allow(null)
  })
}

const update = {
  body: Joi.object({
    title: Joi.string().trim().max(200),
    description: Joi.string().allow(''),
    visibility: Joi.string().valid('private', 'public'),
    folderId: objectId.allow(null)
  }).min(1)
}

const list = {
  query: Joi.object({
    folderId: objectId
  })
}

export default { create, update, list }
