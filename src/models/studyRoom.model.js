import mongoose, { model } from 'mongoose'
import { ROOM_VISIBILITY, ROOM_STATUS, ROOM_LIMITS } from '../constants/index.js'

const studyRoomSchema = new mongoose.Schema(
  {
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: ROOM_LIMITS.TITLE_MAX
    },
    visibility: {
      type: String,
      enum: Object.values(ROOM_VISIBILITY),
      default: ROOM_VISIBILITY.PRIVATE
    },
    roomCode: {
      type: String,
      required: true,
      unique: true
    },
    pomodoroWorkMin: {
      type: Number,
      default: 25,
      min: ROOM_LIMITS.WORK_MIN,
      max: ROOM_LIMITS.WORK_MAX
    },
    pomodoroBreakMin: {
      type: Number,
      default: 5,
      min: ROOM_LIMITS.BREAK_MIN,
      max: ROOM_LIMITS.BREAK_MAX
    },
    maxParticipants: {
      type: Number,
      default: ROOM_LIMITS.MAX_PARTICIPANTS_DEFAULT,
      min: ROOM_LIMITS.MIN_PARTICIPANTS,
      max: ROOM_LIMITS.MAX_PARTICIPANTS_HARD
    },
    status: {
      type: String,
      enum: Object.values(ROOM_STATUS),
      default: ROOM_STATUS.OPEN,
      index: true
    },
    closedAt: {
      type: Date,
      default: null
    },
    settings: {
      chatEnabled: {
        type: Boolean,
        default: true
      },
      leaderboardEnabled: {
        type: Boolean,
        default: true
      },
      cameraAllowed: {
        type: Boolean,
        default: true
      },
      micAllowed: {
        type: Boolean,
        default: true
      },
      micLocked: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
)

studyRoomSchema.index({ visibility: 1, status: 1, createdAt: -1 })

export default model('StudyRoom', studyRoomSchema)
