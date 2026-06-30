import mongoose, { model } from 'mongoose'

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    otpHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastSentAt: {
      type: Date,
      default: Date.now
    },
    sendCount: {
      type: Number,
      default: 1
    },
    attemptCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
)

// TTL index: Mongo tu xoa pending khi qua expiresAt
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default model('PendingRegistration', pendingRegistrationSchema)
