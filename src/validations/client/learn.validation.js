import Joi from 'joi'

import { LEARN_QUESTION_TYPES, QUESTION_LIMITS } from '../../constants/index.js'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const round = {
  params: Joi.object({ deckId: objectId.required() }),
  query: Joi.object({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(QUESTION_LIMITS.LEARN_MAX_LIMIT)
      .default(QUESTION_LIMITS.DEFAULT_LEARN_LIMIT),
    onlyUnlearned: Joi.boolean().default(true),
    types: Joi.string()
  })
}

const answer = {
  params: Joi.object({ deckId: objectId.required() }),
  body: Joi.object({
    flashcardId: objectId.required(),
    type: Joi.string()
      .valid(...LEARN_QUESTION_TYPES)
      .required(),
    selectedAnswer: Joi.string().allow('', null).max(QUESTION_LIMITS.ANSWER_MAX_LENGTH).required(),
    statement: Joi.string().max(QUESTION_LIMITS.ANSWER_MAX_LENGTH)
  })
}

export default { round, answer }
