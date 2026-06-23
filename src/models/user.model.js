import mongoose, { model } from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true
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
    avatarUrl: {
      type: String,
      default: null
    },
    defaultQuizSize: {
      type: Number,
      default: 10
    }
  },
  {
    timestamps: true
  }
)

export default model('User', userSchema)
