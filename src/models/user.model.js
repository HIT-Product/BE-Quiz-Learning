import mongoose, { model } from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String
    },
    avatar: {
      type: String,
      default: 'https://default-avatar-url.com/avatar.png'
    },
    fullName: {
      type: String,
      trim: true,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      default: 'user'
    },
    totalStudyTime: {
      type: Number,
      default: 0
    },
    streakDays: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
)

export default model('User', userSchema)
