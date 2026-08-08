import Joi from 'joi'

const create = {
  body: Joi.object({
    name: Joi.string().trim().max(160).required()
  })
}

const update = {
  body: Joi.object({
    name: Joi.string().trim().max(160).required()
  })
}

export default {
  create,
  update
}
