import { StatusCodes } from 'http-status-codes'

import { quizService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [POST] /decks/:deckId/quiz
const generate = catchAsync(async (req, res) => {
  const data = await quizService.generate(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Tạo quiz thành công.', data))
})

// [POST] /decks/:deckId/quiz/submit
const submit = catchAsync(async (req, res) => {
  const attempt = await quizService.submit(req.params.deckId, req.user._id, req.body)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Nộp bài thành công.', attempt))
})

export default { generate, submit }
