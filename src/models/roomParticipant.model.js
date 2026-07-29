import mongoose, { model } from 'mongoose'

import { ROOM_ROLE } from '../constants/index.js'

const roomParticipantSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoom',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: Object.values(ROOM_ROLE),
      default: ROOM_ROLE.MEMBER
    },
    joinedAt: { type: Date, default: Date.now },
    joinExpiresAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },
    studySeconds: { type: Number, default: 0, min: 0 },
    kickedAt: { type: Date, default: null },
    bannedAt: { type: Date, default: null },
    banReason: { type: String, trim: true, maxlength: 300, default: null }
  },
  { timestamps: true }
)

roomParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true })
roomParticipantSchema.index({ roomId: 1, studySeconds: -1 })
roomParticipantSchema.index(
  { userId: 1 },
  {
    name: 'one_active_room_per_user',
    unique: true,
    partialFilterExpression: { leftAt: null }
  }
)
roomParticipantSchema.index({ joinExpiresAt: 1 }, { partialFilterExpression: { joinExpiresAt: { $type: 'date' } } })

export default model('RoomParticipant', roomParticipantSchema)
