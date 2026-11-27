import mongoose, { model } from 'mongoose'
import { QUIZ_QUESTION_TYPES } from '../constants/index.js'

const quizAnswerSchema = new mongoose.Schema(
  {
    flashcardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flashcard',
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: QUIZ_QUESTION_TYPES
    },
    correctAnswer: {
      type: String,
      required: true
    },
    selectedAnswer: {
      type: String,
      default: null
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  },
  {
    _id: true
  }
)

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    correctCount: {
      type: Number,
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    gradingAt: {
      type: Date,
      default: null,
      select: false
    },
    submittedAt: {
      type: Date,
      default: null
    },
    answers: [quizAnswerSchema]
  },
  {
    timestamps: false
  }
)

quizAttemptSchema.index({ submittedAt: -1 })

export default model('QuizAttempt', quizAttemptSchema)
