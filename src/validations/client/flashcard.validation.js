import Joi from 'joi'

const create = {
  body: Joi.object({
    front: Joi.string().trim().required(),
    back: Joi.string().trim().required(),
    sortOrder: Joi.number().integer().min(0),
    distractors: Joi.array().items(Joi.string().trim()).default([])
  })
}

const update = {
  body: Joi.object({
    front: Joi.string().trim(),
    back: Joi.string().trim(),
    sortOrder: Joi.number().integer().min(0),
    distractors: Joi.array().items(Joi.string().trim()).default([])
  }).min(1)
}

const reorder = {
  body: Joi.object({
    orderedIds: Joi.array().items(Joi.string()).min(1).required()
  })
}

export default { create, update, reorder }
