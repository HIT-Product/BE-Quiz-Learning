import Joi from 'joi'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const QUESTION_TYPES = ['multiple_choice', 'true_false', 'written']

const round = {
  params: Joi.object({ deckId: objectId.required() }),
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
    onlyUnlearned: Joi.boolean().default(true),
    types: Joi.string()
  })
}

const answer = {
  params: Joi.object({ deckId: objectId.required() }),
  body: Joi.object({
    flashcardId: objectId.required(),
    type: Joi.string()
      .valid(...QUESTION_TYPES)
      .required(),
    selectedAnswer: Joi.string().allow('', null).max(2000).required(),
    statement: Joi.string().max(2000)
  })
}

export default { round, answer }
