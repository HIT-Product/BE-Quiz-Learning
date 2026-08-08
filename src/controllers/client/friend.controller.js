import { StatusCodes } from 'http-status-codes'

import { friendService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [POST] /friends/requests
const sendRequest = catchAsync(async (req, res) => {
  const data = await friendService.sendRequest(req.user._id, req.body.userId)
  const message = data.autoAccepted
    ? 'Hai nguoi da tro thanh ban be.'
    : 'Gui loi moi ket ban thanh cong.'
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, message, data))
})

// [POST] /friends/requests/:id/accept
const acceptRequest = catchAsync(async (req, res) => {
  const data = await friendService.acceptRequest(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Chap nhan loi moi thanh cong.', data))
})

// [POST] /friends/requests/:id/decline
const declineRequest = catchAsync(async (req, res) => {
  const data = await friendService.declineRequest(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Tu choi loi moi thanh cong.', data))
})

// [DELETE] /friends/requests/:id
const cancelRequest = catchAsync(async (req, res) => {
  await friendService.cancelRequest(req.params.id, req.user._id)
  res.status(StatusCodes.NO_CONTENT).send()
})

// [DELETE] /friends/:id
const unfriend = catchAsync(async (req, res) => {
  await friendService.unfriend(req.user._id, req.params.id)
  res.status(StatusCodes.NO_CONTENT).send()
})

// [GET] /friends
const listFriends = catchAsync(async (req, res) => {
  const data = await friendService.listFriends(req.user._id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay danh sach ban be thanh cong.', data))
})

// [GET] /friends/requests
const listPendingRequests = catchAsync(async (req, res) => {
  const data = await friendService.listPendingRequests(req.user._id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay danh sach loi moi thanh cong.', data))
})

// [GET] /friends/presence
const getFriendsPresence = catchAsync(async (req, res) => {
  const data = await friendService.getFriendsPresence(req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay trang thai hien dien ban be thanh cong.', data))
})

export default {
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  unfriend,
  listFriends,
  listPendingRequests,
  getFriendsPresence
}
