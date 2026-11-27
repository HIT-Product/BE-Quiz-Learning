import Joi from 'joi'
import { LEARNING_STATUSES } from '../../constants/index.js'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const start = {
  params: Joi.object({ deckId: objectId.required() }),
  query: Joi.object({
    filter: Joi.string()
      .valid('all', ...LEARNING_STATUSES)
      .default('all')
  })
}

const review = {
  params: Joi.object({
    deckId: objectId.required(),
    cardId: objectId.required()
  }),
  body: Joi.object({
    remembered: Joi.boolean().required()
  })
}

export default { start, review }
