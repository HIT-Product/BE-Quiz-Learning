import mongoose, { model } from 'mongoose'

import { FLASHCARD_SOURCE, FLASHCARD_SOURCES, FLASHCARD_TYPE, FLASHCARD_TYPES } from '../constants/index.js'

const flashcardSchema = new mongoose.Schema(
  {
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true
    },
    front: {
      type: String,
      required: true
    },
    back: {
      type: String,
      required: true
    },
    stem: {
      type: String,
      default: ''
    },
    cardType: {
      type: String,
      enum: FLASHCARD_TYPES,
      default: FLASHCARD_TYPE.BASIC
    },
    distractors: {
      type: [String],
      default: []
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      enum: FLASHCARD_SOURCES,
      default: FLASHCARD_SOURCE.MANUAL
    }
  },
  {
    timestamps: true
  }
)

flashcardSchema.index({ deckId: 1, sortOrder: 1 })

export default model('Flashcard', flashcardSchema)
