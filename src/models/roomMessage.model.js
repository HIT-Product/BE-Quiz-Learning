import mongoose, { model } from 'mongoose'
import { ROOM_LIMITS } from '../constants/index.js'

const roomMessageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRoom', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: ROOM_LIMITS.MESSAGE_MAX },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
)

roomMessageSchema.index({ roomId: 1, createdAt: -1 })

export default model('RoomMessage', roomMessageSchema)
