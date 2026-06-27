import { StatusCodes } from 'http-status-codes'

import { learnService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /decks/:deckId/learn
const round = catchAsync(async (req, res) => {
  const types = req.query.types ? req.query.types.split(',') : undefined
  const data = await learnService.buildRound(req.params.deckId, req.user._id, {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    onlyUnlearned: req.query.onlyUnlearned !== 'false',
    types
  })

  const safe = data.questions.map(({ correctAnswer, ...rest }) => rest)

  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Tạo vòng học thành công.', { ...data, questions: safe }))
})

// [POST] /decks/:deckId/learn/answer
const answer = catchAsync(async (req, res) => {
  const result = await learnService.submitAnswer(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Chấm câu trả lời thành công.', result))
})

export default { round, answer }
