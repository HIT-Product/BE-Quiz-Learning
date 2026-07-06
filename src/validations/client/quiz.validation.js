import Joi from 'joi'

import { QUESTION_LIMITS, QUESTION_TYPE, QUIZ_QUESTION_TYPES } from '../../constants/index.js'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const generate = {
  params: Joi.object({
    deckId: objectId.required()
  }),
  body: Joi.object({
    types: Joi.array()
      .items(Joi.string().valid(...QUIZ_QUESTION_TYPES))
      .unique()
      .max(QUIZ_QUESTION_TYPES.length)
      .default([QUESTION_TYPE.MULTIPLE_CHOICE]),
    limit: Joi.number().integer().min(1).max(QUESTION_LIMITS.QUIZ_MAX_LIMIT)
  })
}

const submit = {
  params: Joi.object({
    deckId: objectId.required()
  }),
  body: Joi.object({
    attemptId: objectId.required(),
    answers: Joi.array()
      .min(1)
      .max(QUESTION_LIMITS.SUBMIT_MAX_ANSWERS)
      .items(
        Joi.object({
          questionId: objectId.required(),
          selectedAnswer: Joi.string().allow('', null).max(QUESTION_LIMITS.ANSWER_MAX_LENGTH)
        })
      )
      .required()
  })
}

export default { generate, submit }
