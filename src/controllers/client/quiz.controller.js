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

const getResult = catchAsync(async (req, res) => {
  const attempt = await quizService.getResult(req.params.deckId, req.user._id, req.params.attemptId)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy kết quả bài kiểm tra thành công.', attempt))
})

export default { generate, submit, getResult }
