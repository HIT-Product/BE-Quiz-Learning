import mongoose, { model } from 'mongoose'

import {
  ACTIVITY_VISIBILITY,
  FRIEND_REQUEST_POLICY,
  USER_LIMITS
} from '../constants/index.js'

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
    },
    username: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      minlength: USER_LIMITS.USERNAME_MIN_LENGTH,
      maxlength: USER_LIMITS.USERNAME_MAX_LENGTH
    },
    usernameUpdatedAt: {
      type: Date,
      default: null
    },
    activityVisibility: {
      type: String,
      enum: Object.values(ACTIVITY_VISIBILITY),
      default: ACTIVITY_VISIBILITY.FRIENDS
    },
    friendRequestPolicy: {
      type: String,
      enum: Object.values(FRIEND_REQUEST_POLICY),
      default: FRIEND_REQUEST_POLICY.EVERYONE
    }
  },
  {
    timestamps: true
  }
)

userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
)
userSchema.index({ displayName: 'text' })

export default model('User', userSchema)
