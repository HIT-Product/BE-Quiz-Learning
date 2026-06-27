import { StatusCodes } from 'http-status-codes'

import { studyService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /decks/:deckId/study
const startSession = catchAsync(async (req, res) => {
  const data = await studyService.startSession(req.params.deckId, req.user._id, req.query.filter)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Bắt đầu phiên học thành công.', data))
})

// [POST] /decks/:deckId/study/cards/:cardId/review
const reviewCard = catchAsync(async (req, res) => {
  const progress = await studyService.reviewCard(
    req.params.deckId,
    req.params.cardId,
    req.user._id,
    req.body.remembered
  )
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật tiến độ thành công.', progress))
})

export default { startSession, reviewCard }
