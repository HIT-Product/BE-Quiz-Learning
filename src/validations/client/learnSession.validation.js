import Joi from 'joi'

import {
  QUESTION_TYPE,
  LEARN_SESSION_MODE,
  LEARN_ANSWER_SIDE,
  LEARN_SCOPE,
  LEARN_SESSION_LIMITS,
  WRITTEN_GRADE_MODE
} from '../../constants/index.js'

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('id khong hop le')

const configSchema = Joi.object({
  types: Joi.array()
    .items(Joi.string().valid(...Object.values(QUESTION_TYPE)))
    .min(1),
  answerSide: Joi.string().valid(...Object.values(LEARN_ANSWER_SIDE)),
  blockSize: Joi.number().integer().min(LEARN_SESSION_LIMITS.BLOCK_SIZE_MIN).max(LEARN_SESSION_LIMITS.BLOCK_SIZE_MAX),
  activeSetSize: Joi.number()
    .integer()
    .min(LEARN_SESSION_LIMITS.ACTIVE_SET_SIZE_MIN)
    .max(LEARN_SESSION_LIMITS.ACTIVE_SET_SIZE_MAX),
  sessionLimit: Joi.number()
    .integer()
    .min(LEARN_SESSION_LIMITS.SESSION_LIMIT_MIN)
    .max(LEARN_SESSION_LIMITS.SESSION_LIMIT_MAX),
  scope: Joi.string().valid(...Object.values(LEARN_SCOPE)),
  writtenGradeMode: Joi.string().valid(...Object.values(WRITTEN_GRADE_MODE)),
  retypeWrongAnswers: Joi.boolean(),
  timeTargetMin: Joi.number()
    .integer()
    .min(LEARN_SESSION_LIMITS.TIME_TARGET_MIN)
    .max(LEARN_SESSION_LIMITS.TIME_TARGET_MAX)
})

const start = {
  params: Joi.object({ deckId: objectId.required() }),
  body: Joi.object({
    mode: Joi.string()
      .valid(...Object.values(LEARN_SESSION_MODE))
      .default(LEARN_SESSION_MODE.MASTER),
    config: configSchema.default({})
  })
}

const current = {
  params: Joi.object({ deckId: objectId.required() })
}

const answer = {
  params: Joi.object({ deckId: objectId.required() }),
  body: Joi.object({
    flashcardId: objectId.required(),
    selectedAnswer: Joi.string().allow('', null).max(2000),
    known: Joi.boolean(),
    dontKnow: Joi.boolean()
  })
}

const override = {
  params: Joi.object({ deckId: objectId.required() })
}

const retype = {
  params: Joi.object({ deckId: objectId.required() }),
  body: Joi.object({
    flashcardId: objectId.required(),
    typedAnswer: Joi.string().max(2000).required()
  })
}

const reset = {
  params: Joi.object({ deckId: objectId.required() }),
  body: Joi.object({
    restart: Joi.boolean().default(false),
    resetProgress: Joi.boolean().default(false),
    mode: Joi.string().valid(...Object.values(LEARN_SESSION_MODE)),
    config: configSchema
  })
}

export default { start, current, answer, retype, override, reset }
