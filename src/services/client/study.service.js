import { StatusCodes } from 'http-status-codes'

import { DECK_VISIBILITY, LEARNING_STATUS } from '../../constants/index.js'
import { deckModel, flashcardModel, cardProgressModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'

// Kiểm tra quyền truy cập deck
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== DECK_VISIBILITY.PUBLIC) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Bắt đầu phiên lật thẻ
const startSession = async (deckId, userId, filter = 'all') => {
  await getAccessibleDeck(deckId, userId)

  const cards = await flashcardModel.find({ deckId }).sort({ sortOrder: 1, createdAt: 1 })

  const progresses = await cardProgressModel.find({
    userId,
    flashcardId: { $in: cards.map((c) => c._id) }
  })
  const statusMap = new Map(progresses.map((p) => [p.flashcardId.toString(), p.status]))

  const withStatus = cards.map((card) => ({
    _id: card._id,
    front: card.front,
    back: card.back,
    status: statusMap.get(card._id.toString()) || LEARNING_STATUS.NEW
  }))

  const summary = { total: cards.length, new: 0, learning: 0, remembered: 0 }
  for (const c of withStatus) summary[c.status]++

  let items = withStatus
  if (filter === LEARNING_STATUS.NEW) {
    items = withStatus.filter((i) => i.status === LEARNING_STATUS.NEW)
  } else if (filter === LEARNING_STATUS.LEARNING) {
    items = withStatus.filter((i) => i.status === LEARNING_STATUS.NEW || i.status === LEARNING_STATUS.LEARNING)
  }

  return { deckId, filter, summary, sessionSize: items.length, cards: items }
}

// Đánh dấu kết quả lật thẻ
const reviewCard = async (deckId, cardId, userId, remembered) => {
  await getAccessibleDeck(deckId, userId)

  const card = await flashcardModel.findOne({ _id: cardId, deckId })
  if (!card) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')
  }

  const status = remembered ? LEARNING_STATUS.REMEMBERED : LEARNING_STATUS.LEARNING

  const progress = await cardProgressModel.findOneAndUpdate(
    { userId, flashcardId: cardId },
    {
      $set: { status, lastReviewedAt: new Date() },
      $inc: { reviewCount: 1 },
      $setOnInsert: { userId, flashcardId: cardId }
    },
    { new: true, upsert: true }
  )

  return progress
}

export default { startSession, reviewCard }
