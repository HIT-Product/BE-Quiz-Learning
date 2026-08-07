import { StatusCodes } from 'http-status-codes'

import { studyRoomService } from '../../services/client/index.js'
import { getIO } from '../../sockets/index.js'
import { roomRealtimeService } from '../../sockets/services/index.js'
import { catchAsync, response } from '../../utils/index.js'

const create = catchAsync(async (req, res) => {
  const room = await studyRoomService.create(req.user._id, req.body)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Tạo phòng học thành công.', room))
})

const list = catchAsync(async (req, res) => {
  const data = await studyRoomService.list(req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy danh sách phòng học thành công.', data))
})

const joinByCode = catchAsync(async (req, res) => {
  const room = await studyRoomService.joinByCode(req.user._id, req.body.roomCode)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Tham gia phòng học thành công.', room))
})

const getById = catchAsync(async (req, res) => {
  const room = await studyRoomService.getById(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy thông tin phòng học thành công.', room))
})

const listMessages = catchAsync(async (req, res) => {
  const messages = await studyRoomService.listMessages(req.params.id, req.user._id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy tin nhắn phòng học thành công.', messages))
})

const leaderboard = catchAsync(async (req, res) => {
  const data = await studyRoomService.leaderboard(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy bảng xếp hạng thành công.', data))
})

const mediaToken = catchAsync(async (req, res) => {
  const deviceId = req.get('x-device-id')
  const data = await studyRoomService.mediaToken(req.params.id, req.user._id, {
    deviceId,
    sessionId: req.user.sessionId
  })
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Tạo media token thành công.', data))
})

const close = catchAsync(async (req, res) => {
  const room = await roomRealtimeService.closeRoom(getIO().of('/study-rooms'), req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đóng phòng học thành công.', room))
})

export default { create, list, joinByCode, getById, listMessages, leaderboard, mediaToken, close }
