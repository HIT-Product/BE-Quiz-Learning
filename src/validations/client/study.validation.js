import Joi from 'joi'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const review = {
  params: Joi.object({
    deckId: objectId.required(),
    cardId: objectId.required()
  }),
  body: Joi.object({
    remembered: Joi.boolean().required()
  })
}

export default { review }
