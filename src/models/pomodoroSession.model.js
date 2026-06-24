import mongoose, { model } from 'mongoose'

const pomodoroSessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoom',
      required: true
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    phase: {
      type: String,
      enum: ['work', 'break'],
      required: true
    },
    durationMin: {
      type: Number,
      required: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    endedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: false
  }
)

export default model('PomodoroSession', pomodoroSessionSchema)
