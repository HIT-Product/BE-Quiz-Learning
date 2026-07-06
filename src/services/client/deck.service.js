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

  await deckModel.updateOne({ _id: sourceDeckId }, { $inc: { copyCount: 1 } })

  return newDeck
}

const listPublic = async ({ q, sort, page, limit } = {}) => {
  // Tự coerce + default vì middleware không ghi lại req.query, query params là string
  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 20))
  const sortKey = sort === 'popular' ? 'popular' : 'newest'
  const keyword = (q || '').trim()
  const skip = (pageNum - 1) * limitNum

  // Có từ khóa: dùng $text search, sort theo relevance score
  if (keyword) {
    const filter = { visibility: 'public', $text: { $search: keyword } }
    const projection = { score: { $meta: 'textScore' } }
    const [data, total] = await Promise.all([
      deckModel
        .find(filter, projection)
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limitNum),
      deckModel.countDocuments(filter)
    ])
    return { data, total, page: pageNum, limit: limitNum }
  }

  // Không có từ khóa: sort theo field
  const sortField = sortKey === 'popular' ? { copyCount: -1 } : { createdAt: -1 }
  const filter = { visibility: 'public' }
  const [data, total] = await Promise.all([
    deckModel.find(filter).sort(sortField).skip(skip).limit(limitNum),
    deckModel.countDocuments(filter)
  ])
  return { data, total, page: pageNum, limit: limitNum }
}

export default { list, listPublic, getById, create, update, remove, copy }
