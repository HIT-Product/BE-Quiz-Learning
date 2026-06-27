import { StatusCodes } from 'http-status-codes'

import { deckModel, flashcardModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'

// Kiem tra deck so huu
const assertOwnedDeck = async (deckId, ownerId) => {
  const deck = await deckModel.findOne({ _id: deckId, ownerId })
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Dong bo so luong flashcard
const syncCardCount = async (deckId) => {
  const count = await flashcardModel.countDocuments({ deckId })
  await deckModel.updateOne({ _id: deckId }, { cardCount: count })
  return count
}

// Lay danh sach flashcard
const list = async (deckId, ownerId) => {
  await assertOwnedDeck(deckId, ownerId)
  return flashcardModel.find({ deckId }).sort({ sortOrder: 1, createdAt: 1 })
}

// Tao flashcard
const create = async (deckId, ownerId, { front, back, sortOrder, distractors }) => {
  await assertOwnedDeck(deckId, ownerId)

  let order = sortOrder
  if (order === undefined) {
    const last = await flashcardModel.findOne({ deckId }).sort({ sortOrder: -1 })
    order = last ? last.sortOrder + 1 : 0
  }

  const card = await flashcardModel.create({ deckId, front, back, distractors, sortOrder: order, source: 'manual' })
  await syncCardCount(deckId)
  return card
}

// Cap nhat flashcard
const update = async (deckId, cardId, ownerId, payload) => {
  await assertOwnedDeck(deckId, ownerId)

  const card = await flashcardModel.findOne({ _id: cardId, deckId })
  if (!card) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')
  }

  Object.assign(card, payload)
  await card.save()
  return card
}

// Xoa flashcard
const remove = async (deckId, cardId, ownerId) => {
  await assertOwnedDeck(deckId, ownerId)

  const result = await flashcardModel.deleteOne({ _id: cardId, deckId })
  if (result.deletedCount === 0) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')
  }

  await syncCardCount(deckId)
}

// Sap xep flashcard
const reorder = async (deckId, ownerId, orderedIds) => {
  await assertOwnedDeck(deckId, ownerId)

  const operations = orderedIds.map((cardId, index) => ({
    updateOne: {
      filter: { _id: cardId, deckId },
      update: { sortOrder: index }
    }
  }))

  await flashcardModel.bulkWrite(operations)
  return flashcardModel.find({ deckId }).sort({ sortOrder: 1 })
}

export default { list, create, update, remove, reorder }
