import Joi from 'joi'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id không hợp lệ')

const QUESTION_TYPES = ['multiple_choice', 'true_false', 'written']

const generate = {
  params: Joi.object({
    deckId: objectId.required()
  }),
  body: Joi.object({
    types: Joi.array()
      .items(Joi.string().valid(...QUESTION_TYPES))
      .unique()
      .max(3)
      .default(['multiple_choice']),
    limit: Joi.number().integer().min(1).max(100)
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
      .max(200)
      .items(
        Joi.object({
          questionId: objectId.required(),
          selectedAnswer: Joi.string().allow('', null).max(2000)
        })
      )
      .required()
  })
}

export default { generate, submit }
