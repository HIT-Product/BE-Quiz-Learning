import Joi from 'joi'

import { redisClient } from '../../configs/index.js'
import { roomMessageModel, studyRoomModel } from '../../models/index.js'
import { ROOM_REDIS_KEY, ROOM_LIMITS } from '../../constants/index.js'
import { safeHandler, socketError } from '../utils/socketHandler.js'

const chatSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required(),
  message: Joi.string().trim().min(1).max(ROOM_LIMITS.MESSAGE_MAX).required()
})

const deleteSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required(),
  messageId: Joi.string().hex().length(24).required()
})

const CHAT_RL = { MAX: 5, WINDOW_SEC: 10 }

const registerChatHandlers = (nsp, socket) => {
  const userId = socket.user._id

  socket.on(
    'chat:send',
    safeHandler(async (payload) => {
      const { value, error } = chatSchema.validate(payload, { abortEarly: false, stripUnknown: true })
      if (error) throw socketError('INVALID_PAYLOAD', 'Noi dung tin nhan khong hop le.')

      const { roomId, message } = value
      if (socket.data.roomId !== roomId) throw socketError('NOT_PARTICIPANT', 'Ban chua tham gia phong.')
      if (!socket.data.chatEnabled) throw socketError('CHAT_DISABLED', 'Chat dang bi tat trong phong nay.')

      const rlKey = ROOM_REDIS_KEY.RL_CHAT(userId)
      const count = await redisClient.incr(rlKey)
      if (count === 1) await redisClient.expire(rlKey, CHAT_RL.WINDOW_SEC)
      if (count > CHAT_RL.MAX) throw socketError('RATE_LIMITED', 'Ban dang gui tin qua nhanh. Hay cho mot chut.')

      const doc = await roomMessageModel.create({ roomId, senderId: userId, message })
      const data = { message: { ...doc.toObject(), sender: socket.data.profile } }
      nsp.to(`room:${roomId}`).emit('chat:new', data)
      return data
    })
  )

  socket.on(
    'chat:delete',
    safeHandler(async (payload) => {
      const { value, error } = deleteSchema.validate(payload, { abortEarly: false, stripUnknown: true })
      if (error) throw socketError('INVALID_PAYLOAD', 'Payload xoa tin nhan khong hop le.')

      const { roomId, messageId } = value
      if (socket.data.roomId !== roomId) throw socketError('NOT_PARTICIPANT', 'Ban chua tham gia phong.')

      const msg = await roomMessageModel.findOne({ _id: messageId, roomId, deletedAt: null })
      if (!msg) throw socketError('NOT_FOUND', 'Tin nhan khong ton tai.')

      const room = await studyRoomModel.findById(roomId).select('hostId').lean()
      const isHost = String(room?.hostId) === String(userId)
      const isSender = String(msg.senderId) === String(userId)
      if (!isHost && !isSender) throw socketError('FORBIDDEN', 'Ban khong co quyen xoa tin nhan nay.')

      msg.deletedAt = new Date()
      msg.deletedBy = userId
      await msg.save()

      const data = { messageId }
      nsp.to(`room:${roomId}`).emit('chat:deleted', data)
      return data
    })
  )
}

export default registerChatHandlers
