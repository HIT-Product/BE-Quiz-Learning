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
  const data = await studyRoomService.list(req.validatedQuery)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy danh sách phòng học thành công.', data))
})

const joinByCode = catchAsync(async (req, res) => {
  const room = await studyRoomService.joinByCode(req.user._id, req.body.roomCode)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Tham gia phòng học thành công.', room))
})

const cancelReservation = catchAsync(async (req, res) => {
  await studyRoomService.cancelReservation(req.params.id, req.user._id, req.body.reservationExpiresAt)
  res.status(StatusCodes.NO_CONTENT).end()
})

const getById = catchAsync(async (req, res) => {
  const room = await studyRoomService.getById(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy thông tin phòng học thành công.', room))
})

const listMessages = catchAsync(async (req, res) => {
  const messages = await studyRoomService.listMessages(req.params.id, req.user._id, req.validatedQuery)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy tin nhắn phòng học thành công.', messages))
})

const leaderboard = catchAsync(async (req, res) => {
  const data = await studyRoomService.leaderboard(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy bảng xếp hạng thành công.', data))
})

const getSummary = catchAsync(async (req, res) => {
  const data = await studyRoomService.getSummary(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy tổng kết phòng học thành công.', data))
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

export default {
  create,
  list,
  joinByCode,
  cancelReservation,
  getById,
  listMessages,
  leaderboard,
  getSummary,
  mediaToken,
  close
}
