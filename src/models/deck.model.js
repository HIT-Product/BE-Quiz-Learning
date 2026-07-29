import mongoose, { model } from 'mongoose'

import { DECK_LIMITS, DECK_VISIBILITIES, DECK_VISIBILITY } from '../constants/index.js'

const deckSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: DECK_LIMITS.TITLE_MAX_LENGTH
    },
    description: {
      type: String,
      default: ''
    },
    visibility: {
      type: String,
      enum: DECK_VISIBILITIES,
      default: DECK_VISIBILITY.PRIVATE
    },
    copiedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      default: null
    },
    cardCount: {
      type: Number,
      default: 0
    },
    copyCount: {
      type: Number,
      default: 0
    },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }
  },
  {
    timestamps: true
  }
)

deckSchema.index({ title: 'text', description: 'text' })

export default model('Deck', deckSchema)
