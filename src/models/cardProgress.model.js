import mongoose, { model } from 'mongoose'

import { LEARNING_STATUS, LEARNING_STATUSES } from '../constants/index.js'

const cardProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    flashcardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flashcard',
      required: true
    },
    status: {
      type: String,
      enum: LEARNING_STATUSES,
      default: LEARNING_STATUS.NEW
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    lastReviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: false
  }
)

cardProgressSchema.index({ userId: 1, flashcardId: 1 }, { unique: true })

export default model('CardProgress', cardProgressSchema)
