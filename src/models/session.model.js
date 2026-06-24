import mongoose, { model } from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tokenHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
)

sessionSchema.index({ userId: 1 })
sessionSchema.index({ tokenHash: 1 })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default model('Session', sessionSchema)
