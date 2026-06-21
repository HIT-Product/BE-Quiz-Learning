import mongoose, { model } from 'mongoose'

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
    sortOrder: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      enum: ['manual', 'import', 'copy'],
      default: 'manual'
    }
  },
  {
    timestamps: true
  }
)

export default model('Flashcard', flashcardSchema)
