import { StatusCodes } from 'http-status-codes'

import { flashcardService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /decks/:deckId/cards
const list = catchAsync(async (req, res) => {
  const cards = await flashcardService.list(req.params.deckId, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy danh sách thẻ thành công.', cards))
})

// [POST] /decks/:deckId/cards
const create = catchAsync(async (req, res) => {
  const card = await flashcardService.create(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Tạo thẻ thành công.', card))
})

// [PUT] /decks/:deckId/cards/:cardId
const update = catchAsync(async (req, res) => {
  const card = await flashcardService.update(req.params.deckId, req.params.cardId, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật thẻ thành công.', card))
})

// [DELETE] /decks/:deckId/cards/:cardId
const remove = catchAsync(async (req, res) => {
  await flashcardService.remove(req.params.deckId, req.params.cardId, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Xóa thẻ thành công.'))
})

// [PUT] /decks/:deckId/cards/reorder
const reorder = catchAsync(async (req, res) => {
  const cards = await flashcardService.reorder(req.params.deckId, req.user._id, req.body.orderedIds)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Sắp xếp lại thẻ thành công.', cards))
})

export default { list, create, update, remove, reorder }
