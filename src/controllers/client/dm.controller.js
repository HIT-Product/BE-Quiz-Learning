import { StatusCodes } from 'http-status-codes'

import { dmService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /conversations
const listConversations = catchAsync(async (req, res) => {
  const data = await dmService.listConversations(req.user._id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay danh sach cuoc tro chuyen thanh cong.', data))
})

// [POST] /conversations/messages
const sendMessage = catchAsync(async (req, res) => {
  const { recipientId, clientMessageId, body } = req.body
  const data = await dmService.sendMessage(req.user._id, recipientId, { body, clientMessageId })
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Gui tin nhan thanh cong.', data))
})

// [GET] /conversations/:id/messages
const listMessages = catchAsync(async (req, res) => {
  const data = await dmService.listMessages(req.user._id, req.params.id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay lich su tin nhan thanh cong.', data))
})

// [POST] /conversations/:id/read
const markRead = catchAsync(async (req, res) => {
  await dmService.markRead(req.user._id, req.params.id)
  res.status(StatusCodes.NO_CONTENT).send()
})

export default { listConversations, sendMessage, listMessages, markRead }
