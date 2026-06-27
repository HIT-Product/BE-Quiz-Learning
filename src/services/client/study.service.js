import { StatusCodes } from 'http-status-codes'

import { deckModel, flashcardModel, cardProgressModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'

// Kiem tra quyen truy cap deck
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== 'public') {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Bat dau phien lat the
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
    status: statusMap.get(card._id.toString()) || 'new'
  }))

  const summary = { total: cards.length, new: 0, learning: 0, remembered: 0 }
  for (const c of withStatus) summary[c.status]++

  let items = withStatus
  if (filter === 'new') {
    items = withStatus.filter((i) => i.status === 'new')
  } else if (filter === 'learning') {
    items = withStatus.filter((i) => i.status === 'new' || i.status === 'learning')
  }

  return { deckId, filter, summary, sessionSize: items.length, cards: items }
}

// Danh dau ket qua lat the
const reviewCard = async (deckId, cardId, userId, remembered) => {
  await getAccessibleDeck(deckId, userId)

  const card = await flashcardModel.findOne({ _id: cardId, deckId })
  if (!card) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')
  }

  const status = remembered ? 'remembered' : 'learning'

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
