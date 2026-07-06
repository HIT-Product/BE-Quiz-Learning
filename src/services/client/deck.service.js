import { StatusCodes } from 'http-status-codes'

import { DECK_VISIBILITY, FLASHCARD_SOURCE } from '../../constants/index.js'
import { deckModel, flashcardModel, folderModel, deckCopyLogModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'

// Tìm deck sở hữu
const findOwnedDeck = async (deckId, ownerId) => {
  const deck = await deckModel.findOne({ _id: deckId, ownerId })
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Kiểm tra folder sở hữu
const assertOwnedFolder = async (folderId, ownerId) => {
  if (!folderId) return
  const folder = await folderModel.findOne({ _id: folderId, ownerId })
  if (!folder) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thư mục.')
  }
}

// Lấy danh sách deck của tôi
const list = async (ownerId, { folderId } = {}) => {
  const filter = { ownerId }
  if (folderId) filter.folderId = folderId
  return deckModel.find(filter).sort({ createdAt: -1 })
}

// Lấy danh sách deck public
const listPublic = async () => {
  return deckModel.find({ visibility: DECK_VISIBILITY.PUBLIC }).sort({ createdAt: -1 })
}

// Lấy chi tiết deck
const getById = async (deckId, userId) => {
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

// Tạo deck
const create = async (ownerId, payload) => {
  await assertOwnedFolder(payload.folderId, ownerId)
  return deckModel.create({ ...payload, ownerId })
}

// Cập nhật deck
const update = async (deckId, ownerId, payload) => {
  const deck = await findOwnedDeck(deckId, ownerId)
  if (payload.folderId !== undefined) {
    await assertOwnedFolder(payload.folderId, ownerId)
  }
  Object.assign(deck, payload)
  await deck.save()
  return deck
}

// Xoá deck
const remove = async (deckId, ownerId) => {
  const deck = await findOwnedDeck(deckId, ownerId)
  await flashcardModel.deleteMany({ deckId: deck._id })
  await deck.deleteOne()
}

// Copy deck public
const copy = async (sourceDeckId, userId) => {
  const source = await deckModel.findById(sourceDeckId)
  if (!source || source.visibility !== DECK_VISIBILITY.PUBLIC) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ công khai.')
  }

  const sourceCards = await flashcardModel.find({ deckId: source._id }).sort({ sortOrder: 1 })

  const newDeck = await deckModel.create({
    ownerId: userId,
    title: source.title,
    description: source.description,
    visibility: DECK_VISIBILITY.PRIVATE,
    copiedFromId: source._id,
    cardCount: sourceCards.length
  })

  if (sourceCards.length > 0) {
    const clonedCards = sourceCards.map((card) => ({
      deckId: newDeck._id,
      front: card.front,
      back: card.back,
      sortOrder: card.sortOrder,
      source: FLASHCARD_SOURCE.COPY
    }))
    await flashcardModel.insertMany(clonedCards)
  }

  await deckCopyLogModel.create({
    sourceDeckId: source._id,
    copiedDeckId: newDeck._id,
    copiedBy: userId
  })

  return newDeck
}

export default { list, listPublic, getById, create, update, remove, copy }
