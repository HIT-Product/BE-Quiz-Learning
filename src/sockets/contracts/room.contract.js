import Joi from 'joi'

import { ROOM_LIMITS } from '../../constants/index.js'

const ROOM_EVENT = {
  JOIN: 'room:join',
  CONFIRM_SWITCH: 'room:confirm-switch',
  HEARTBEAT: 'room:heartbeat',
  SYNC: 'room:sync',
  LEAVE: 'room:leave',
  KICK: 'room:kick',
  BAN: 'room:ban',
  UNBAN: 'room:unban',
  MUTE_ALL: 'room:mute-all',
  SET_MIC_LOCK: 'room:set-mic-lock',
  CLOSE: 'room:close'
}
const roomJoinSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required(),
  deviceId: Joi.string().trim().min(ROOM_LIMITS.DEVICE_ID_MIN).max(ROOM_LIMITS.DEVICE_ID_MAX).required()
})

const confirmSwitchSchema = Joi.object({
  switchRequestId: Joi.string().guid({ version: 'uuidv4' }).required()
})

const roomActionSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required()
})

export { ROOM_EVENT, confirmSwitchSchema, roomActionSchema, roomJoinSchema }
