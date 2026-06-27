import { StatusCodes } from 'http-status-codes'

import { deckModel, flashcardModel, folderModel, deckCopyLogModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'

// Tim deck so huu
const findOwnedDeck = async (deckId, ownerId) => {
  const deck = await deckModel.findOne({ _id: deckId, ownerId })
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Kiem tra folder so huu
const assertOwnedFolder = async (folderId, ownerId) => {
  if (!folderId) return
  const folder = await folderModel.findOne({ _id: folderId, ownerId })
  if (!folder) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thư mục.')
  }
}

// Lay danh sach deck cua toi
const list = async (ownerId, { folderId } = {}) => {
  const filter = { ownerId }
  if (folderId) filter.folderId = folderId
  return deckModel.find(filter).sort({ createdAt: -1 })
}

// Lay danh sach deck public
const listPublic = async () => {
  return deckModel.find({ visibility: 'public' }).sort({ createdAt: -1 })
}

// Lay chi tiet deck
const getById = async (deckId, userId) => {
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

// Tao deck
const create = async (ownerId, payload) => {
  await assertOwnedFolder(payload.folderId, ownerId)
  return deckModel.create({ ...payload, ownerId })
}

// Cap nhat deck
const update = async (deckId, ownerId, payload) => {
  const deck = await findOwnedDeck(deckId, ownerId)
  if (payload.folderId !== undefined) {
    await assertOwnedFolder(payload.folderId, ownerId)
  }
  Object.assign(deck, payload)
  await deck.save()
  return deck
}

// Xoa deck
const remove = async (deckId, ownerId) => {
  const deck = await findOwnedDeck(deckId, ownerId)
  await flashcardModel.deleteMany({ deckId: deck._id })
  await deck.deleteOne()
}

// Copy deck public
const copy = async (sourceDeckId, userId) => {
  const source = await deckModel.findById(sourceDeckId)
  if (!source || source.visibility !== 'public') {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ công khai.')
  }

  const sourceCards = await flashcardModel.find({ deckId: source._id }).sort({ sortOrder: 1 })

  const newDeck = await deckModel.create({
    ownerId: userId,
    title: source.title,
    description: source.description,
    visibility: 'private',
    copiedFromId: source._id,
    cardCount: sourceCards.length
  })

  if (sourceCards.length > 0) {
    const clonedCards = sourceCards.map((card) => ({
      deckId: newDeck._id,
      front: card.front,
      back: card.back,
      sortOrder: card.sortOrder,
      source: 'copy'
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
