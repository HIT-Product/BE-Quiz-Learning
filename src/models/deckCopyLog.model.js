import mongoose, { model } from 'mongoose'

const deckCopyLogSchema = new mongoose.Schema(
  {
    sourceDeckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true
    },
    copiedDeckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true
    },
    copiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
)

export default model('DeckCopyLog', deckCopyLogSchema)
