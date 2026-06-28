import { StatusCodes } from 'http-status-codes'

import { deckModel, flashcardModel, cardProgressModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { shuffle, normalize } from '../../utils/quiz.js'
import { buildMultipleChoice, buildTrueFalse, buildWritten, buildFlashcard } from './question.service.js'

// Kiem tra quyen truy cap deck
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== 'public') {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Chon dang cau hoi
const pickType = (status, allowedTypes) => {
  const order = {
    new: ['multiple_choice', 'true_false', 'written'],
    learning: ['true_false', 'multiple_choice', 'written'],
    remembered: ['written', 'multiple_choice', 'true_false']
  }
  const prefer = order[status] || order.new
  const usable = prefer.filter((t) => allowedTypes.includes(t))
  return usable[0] || 'multiple_choice'
}

// Sinh vong hoc
const buildRound = async (deckId, userId, { limit = 10, onlyUnlearned = true, types }) => {
  await getAccessibleDeck(deckId, userId)

  const allCards = await flashcardModel.find({ deckId })
  if (allCards.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Bộ thẻ chưa có thẻ học nào.')
  }

  const progresses = await cardProgressModel.find({ userId, flashcardId: { $in: allCards.map((c) => c._id) } })
  const statusMap = new Map(progresses.map((p) => [p.flashcardId.toString(), p.status]))

  let pool = allCards
  if (onlyUnlearned) {
    pool = allCards.filter((c) => (statusMap.get(c._id.toString()) || 'new') !== 'remembered')
    if (pool.length === 0) pool = allCards
  }

  const allowedTypes = types && types.length ? types : ['multiple_choice', 'true_false', 'written']

  const selected = shuffle(pool).slice(0, limit)
  const questions = selected.map((card) => {
    const status = statusMap.get(card._id.toString()) || 'new'

    if (status === 'new' && Math.random() < 0.5) {
      return buildFlashcard(card)
    }

    const type = pickType(status, allowedTypes)
    if (type === 'multiple_choice') return buildMultipleChoice(card, allCards)
    if (type === 'true_false') return buildTrueFalse(card, allCards)
    return buildWritten(card)
  })

  return { deckId, questions }
}

// Tinh trang thai hoc tiep theo
const nextStatus = (current, isCorrect) => {
  if (!isCorrect) return 'learning'
  if (current === 'new') return 'learning'
  return 'remembered'
}

// Cham cau tra loi
const submitAnswer = async (deckId, userId, payload) => {
  await getAccessibleDeck(deckId, userId)

  const { flashcardId, type, selectedAnswer, statement } = payload

  const card = await flashcardModel.findOne({ _id: flashcardId, deckId })
  if (!card) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')

  let isCorrect
  let correctAnswer
  if (type === 'true_false') {
    if (statement === undefined) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Thiếu statement cho câu đúng/sai.')
    }
    const trueValue = normalize(statement) === normalize(card.back) ? 'true' : 'false'
    isCorrect = (selectedAnswer || '').toLowerCase() === trueValue
    correctAnswer = trueValue
  } else {
    correctAnswer = card.back
    isCorrect = normalize(selectedAnswer || '') === normalize(correctAnswer)
  }

  const existing = await cardProgressModel.findOne({ userId, flashcardId })
  const current = existing?.status || 'new'
  const status = nextStatus(current, isCorrect)

  const progress = await cardProgressModel.findOneAndUpdate(
    { userId, flashcardId },
    {
      $set: { status, lastReviewedAt: new Date() },
      $inc: { reviewCount: 1 },
      $setOnInsert: { userId, flashcardId }
    },
    { new: true, upsert: true }
  )

  return { isCorrect, correctAnswer, status: progress.status }
}

export default { buildRound, submitAnswer }
