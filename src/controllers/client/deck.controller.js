import { StatusCodes } from 'http-status-codes'

import { deckService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /decks
const list = catchAsync(async (req, res) => {
  const decks = await deckService.list(req.user._id, { folderId: req.query.folderId })
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy danh sách bộ thẻ thành công.', decks))
})

// [GET] /decks/public
const listPublic = async (req, res) => {
  const { q, sort, page, limit } = req.query
  const result = await deckService.listPublic({ q, sort, page, limit })
  res.status(StatusCodes.OK).json(result)
}

// [GET] /decks/:id
const getById = catchAsync(async (req, res) => {
  const deck = await deckService.getById(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy bộ thẻ thành công.', deck))
})

// [POST] /decks
const create = catchAsync(async (req, res) => {
  const deck = await deckService.create(req.user._id, req.body)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Tạo bộ thẻ thành công.', deck))
})

// [PUT] /decks/:id
const update = catchAsync(async (req, res) => {
  const deck = await deckService.update(req.params.id, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật bộ thẻ thành công.', deck))
})

// [DELETE] /decks/:id
const remove = catchAsync(async (req, res) => {
  await deckService.remove(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Xóa bộ thẻ thành công.'))
})

// [POST] /decks/:id/copy
const copy = catchAsync(async (req, res) => {
  const deck = await deckService.copy(req.params.id, req.user._id)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Sao chép bộ thẻ thành công.', deck))
})

export default { list, listPublic, getById, create, update, remove, copy }
