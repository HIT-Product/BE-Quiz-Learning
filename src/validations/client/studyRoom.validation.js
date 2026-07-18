import Joi from 'joi'
import { ROOM_LIMITS } from '../../constants/index.js'

const objectId = Joi.string().hex().length(24)

const create = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(ROOM_LIMITS.TITLE_MAX).required(),
    pomodoroWorkMin: Joi.number().integer().min(ROOM_LIMITS.WORK_MIN).max(ROOM_LIMITS.WORK_MAX).default(25),
    pomodoroBreakMin: Joi.number().integer().min(ROOM_LIMITS.BREAK_MIN).max(ROOM_LIMITS.BREAK_MAX).default(5),
    maxParticipants: Joi.number()
      .integer()
      .min(ROOM_LIMITS.MIN_PARTICIPANTS)
      .max(ROOM_LIMITS.MAX_PARTICIPANTS_HARD)
      .default(ROOM_LIMITS.MAX_PARTICIPANTS_DEFAULT),
    settings: Joi.object({
      chatEnabled: Joi.boolean(),
      leaderboardEnabled: Joi.boolean(),
      cameraAllowed: Joi.boolean(),
      micAllowed: Joi.boolean(),
      micLocked: Joi.boolean()
    })
  })
}

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    keyword: Joi.string().trim().max(100).allow('')
  })
}

const joinByCode = {
  body: Joi.object({
    roomCode: Joi.string().trim().uppercase().alphanum().length(ROOM_LIMITS.ROOM_CODE_LENGTH).required()
  })
}

const roomIdParam = {
  params: Joi.object({ id: objectId.required() })
}

const listMessages = {
  params: Joi.object({ id: objectId.required() }),
  query: Joi.object({
    before: Joi.date().iso(),
    limit: Joi.number().integer().min(1).max(ROOM_LIMITS.MESSAGE_PAGE_SIZE).default(ROOM_LIMITS.MESSAGE_PAGE_SIZE)
  })
}

export default { create, list, joinByCode, roomIdParam, listMessages }
