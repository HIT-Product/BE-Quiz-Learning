import { StatusCodes } from 'http-status-codes'

import { learnSessionService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [POST] /decks/:deckId/learn/session
const start = catchAsync(async (req, res) => {
  const data = await learnSessionService.startOrResume(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Bat dau phien hoc.', data))
})

// [GET] /decks/:deckId/learn/session
const current = catchAsync(async (req, res) => {
  const data = await learnSessionService.getCurrent(req.params.deckId, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Phien hoc hien tai.', data))
})

// [POST] /decks/:deckId/learn/session/answer
const answer = catchAsync(async (req, res) => {
  const data = await learnSessionService.answer(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cham cau tra loi thanh cong.', data))
})

// [POST] /decks/:deckId/learn/session/override
const override = catchAsync(async (req, res) => {
  const data = await learnSessionService.override(req.params.deckId, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Da ghi nhan dap an dung.', data))
})

// [POST] /decks/:deckId/learn/session/reset
const reset = catchAsync(async (req, res) => {
  const data = await learnSessionService.reset(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Da dat lai phien hoc.', data))
})

export default { start, current, answer, override, reset }
