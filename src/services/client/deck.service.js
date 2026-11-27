import { StatusCodes } from 'http-status-codes'

import { DECK_VISIBILITY, FLASHCARD_SOURCE } from '../../constants/index.js'
import { deckModel, flashcardModel, folderModel, deckCopyLogModel, userModel } from '../../models/index.js'
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

  const newDeck = new deckModel({
    ownerId: userId,
    title: source.title,
    description: source.description,
    visibility: DECK_VISIBILITY.PRIVATE,
    copiedFromId: source._id,
    cardCount: sourceCards.length
  })

  try {
    if (sourceCards.length > 0) {
      const clonedCards = sourceCards.map((card) => ({
        deckId: newDeck._id,
        front: card.front,
        back: card.back,
        stem: card.stem,
        cardType: card.cardType,
        distractors: card.distractors,
        sortOrder: card.sortOrder,
        source: FLASHCARD_SOURCE.COPY
      }))
      await flashcardModel.insertMany(clonedCards)
    }

    await newDeck.save()
    await deckCopyLogModel.create({ sourceDeckId: source._id, copiedDeckId: newDeck._id, copiedBy: userId })
    await deckModel.updateOne({ _id: sourceDeckId }, { $inc: { copyCount: 1 } })
  } catch (error) {
    await Promise.allSettled([
      flashcardModel.deleteMany({ deckId: newDeck._id }),
      deckCopyLogModel.deleteOne({ copiedDeckId: newDeck._id }),
      deckModel.deleteOne({ _id: newDeck._id, ownerId: userId })
    ])
    throw error
  }

  return newDeck
}

const listPublic = async ({ q, sort, page, limit } = {}) => {
  // Tự coerce + default vì middleware không ghi lại req.query, query params là string
  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 20))
  const keyword = (q || '').trim()
  const skip = (pageNum - 1) * limitNum

  const filter = { visibility: DECK_VISIBILITY.PUBLIC }
  let order = { createdAt: -1, _id: -1 }
  let projection
  if (keyword) {
    filter.$text = { $search: keyword }
    projection = { score: { $meta: 'textScore' } }
    if (!sort) order = { score: { $meta: 'textScore' }, ...order }
  }
  if (sort === 'popular') order = { copyCount: -1, ...order }

  const [data, total] = await Promise.all([
    deckModel.find(filter, projection).sort(order).skip(skip).limit(limitNum),
    deckModel.countDocuments(filter)
  ])
  return { data, total, page: pageNum, limit: limitNum }
}

// Lấy đầy đủ dữ liệu cho màn chi tiết deck công khai
const getPublicById = async (deckId) => {
  const deck = await deckModel.findOne({ _id: deckId, visibility: DECK_VISIBILITY.PUBLIC }).lean()
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ công khai.')
  }

  const [owner, cards] = await Promise.all([
    userModel.findById(deck.ownerId).select('displayName avatarUrl').lean(),
    flashcardModel
      .find({ deckId: deck._id })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('front back stem cardType distractors sortOrder')
      .lean()
  ])

  return { ...deck, owner, cards, cardCount: cards.length }
}

export default { list, listPublic, getPublicById, getById, create, update, remove, copy }
