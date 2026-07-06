import { StatusCodes } from 'http-status-codes'

import {
  DECK_VISIBILITY,
  LEARNING_STATUS,
  LEARN_QUESTION_TYPES,
  QUESTION_LIMITS,
  QUESTION_TYPE,
  TRUE_FALSE_ANSWER
} from '../../constants/index.js'
import { deckModel, flashcardModel, cardProgressModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { shuffle, normalize, matchAnswer } from '../../utils/quiz.js'
import { buildMultipleChoice, buildTrueFalse, buildWritten, buildFlashcard } from './question.service.js'

// Kiểm tra quyền truy cập deck
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== DECK_VISIBILITY.PUBLIC) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Chọn dạng câu hỏi
const pickType = (status, allowedTypes) => {
  const order = {
    [LEARNING_STATUS.NEW]: [QUESTION_TYPE.MULTIPLE_CHOICE, QUESTION_TYPE.TRUE_FALSE, QUESTION_TYPE.WRITTEN],
    [LEARNING_STATUS.LEARNING]: [QUESTION_TYPE.TRUE_FALSE, QUESTION_TYPE.MULTIPLE_CHOICE, QUESTION_TYPE.WRITTEN],
    [LEARNING_STATUS.REMEMBERED]: [QUESTION_TYPE.WRITTEN, QUESTION_TYPE.MULTIPLE_CHOICE, QUESTION_TYPE.TRUE_FALSE]
  }
  const prefer = order[status] || order[LEARNING_STATUS.NEW]
  const usable = prefer.filter((t) => allowedTypes.includes(t))
  return usable[0] || QUESTION_TYPE.MULTIPLE_CHOICE
}

// Sinh vòng học
const buildRound = async (
  deckId,
  userId,
  { limit = QUESTION_LIMITS.DEFAULT_LEARN_LIMIT, onlyUnlearned = true, types }
) => {
  await getAccessibleDeck(deckId, userId)

  const allCards = await flashcardModel.find({ deckId })
  if (allCards.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Bộ thẻ chưa có thẻ học nào.')
  }

  const progresses = await cardProgressModel.find({ userId, flashcardId: { $in: allCards.map((c) => c._id) } })
  const statusMap = new Map(progresses.map((p) => [p.flashcardId.toString(), p.status]))

  let pool = allCards
  if (onlyUnlearned) {
    pool = allCards.filter(
      (c) => (statusMap.get(c._id.toString()) || LEARNING_STATUS.NEW) !== LEARNING_STATUS.REMEMBERED
    )
    if (pool.length === 0) pool = allCards
  }

  const allowedTypes = types && types.length ? types : LEARN_QUESTION_TYPES

  const selected = shuffle(pool).slice(0, limit)
  const questions = selected.map((card) => {
    const status = statusMap.get(card._id.toString()) || LEARNING_STATUS.NEW

    if (status === LEARNING_STATUS.NEW && Math.random() < 0.5) {
      return buildFlashcard(card)
    }

    const type = pickType(status, allowedTypes)
    if (type === QUESTION_TYPE.MULTIPLE_CHOICE) return buildMultipleChoice(card, allCards)
    if (type === QUESTION_TYPE.TRUE_FALSE) return buildTrueFalse(card, allCards)
    return buildWritten(card)
  })

  return { deckId, questions }
}

// Tính trạng thái học tiếp theo
const nextStatus = (current, isCorrect) => {
  if (!isCorrect) return LEARNING_STATUS.LEARNING
  if (current === LEARNING_STATUS.NEW) return LEARNING_STATUS.LEARNING
  return LEARNING_STATUS.REMEMBERED
}

// Chấm câu trả lời
const submitAnswer = async (deckId, userId, payload) => {
  await getAccessibleDeck(deckId, userId)

  const { flashcardId, type, selectedAnswer, statement } = payload

  const card = await flashcardModel.findOne({ _id: flashcardId, deckId })
  if (!card) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')

  let isCorrect
  let correctAnswer
  if (type === QUESTION_TYPE.TRUE_FALSE) {
    if (statement === undefined) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Thiếu statement cho câu đúng/sai.')
    }
    const trueValue = normalize(statement) === normalize(card.back) ? TRUE_FALSE_ANSWER.TRUE : TRUE_FALSE_ANSWER.FALSE
    isCorrect = (selectedAnswer || '').toLowerCase() === trueValue
    correctAnswer = trueValue
  } else {
    correctAnswer = card.back
    isCorrect = matchAnswer(selectedAnswer || '', correctAnswer)
  }

  const existing = await cardProgressModel.findOne({ userId, flashcardId })
  const current = existing?.status || LEARNING_STATUS.NEW
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
