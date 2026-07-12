import mongoose, { model } from 'mongoose'

import { USER_LIMITS } from '../constants/index.js'

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
      maxlength: USER_LIMITS.DISPLAY_NAME_MAX_LENGTH
    },
    avatarUrl: {
      type: String,
      default: null
    },
    defaultQuizSize: {
      type: Number,
      default: USER_LIMITS.DEFAULT_QUIZ_SIZE
    }
  },
  {
    timestamps: true
  }
)

export default model('User', userSchema)
