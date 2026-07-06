import mongoose, { model } from 'mongoose'

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
      maxlength: 200
    },
    description: {
      type: String,
      default: ''
    },
    visibility: {
      type: String,
      enum: ['private', 'public'],
      default: 'private'
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
