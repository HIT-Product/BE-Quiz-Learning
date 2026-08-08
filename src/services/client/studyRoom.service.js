import { customAlphabet } from 'nanoid'
import { StatusCodes } from 'http-status-codes'

import { studyRoomModel, roomParticipantModel, roomMessageModel, userModel } from '../../models/index.js'
import roomMediaService from './roomMedia.service.js'
import { ApiError, escapeRegex } from '../../utils/index.js'
import { ROOM_STATUS, ROOM_ROLE, ROOM_VISIBILITY, ROOM_LIMITS } from '../../constants/index.js'

// Tránh ký tự dễ nhầm.
const generateRoomCode = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', ROOM_LIMITS.ROOM_CODE_LENGTH)

const findOpenRoom = async (roomId) => {
  const room = await studyRoomModel.findOne({ _id: roomId, status: ROOM_STATUS.OPEN })
  if (!room) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Phòng học không tồn tại hoặc đã đóng.')
  }
  return room
}

const assertParticipant = async (roomId, userId) => {
  const participant = await roomParticipantModel.findOne({ roomId, userId })
  if (!participant || participant.bannedAt) {
    // Không làm lộ phòng.
    throw new ApiError(StatusCodes.NOT_FOUND, 'Phòng học không tồn tại hoặc bạn chưa tham gia.')
  }
  return participant
}

const assertActiveParticipant = async (roomId, userId) => {
  const participant = await roomParticipantModel.findOne({
    roomId,
    userId,
    leftAt: null,
    kickedAt: null,
    bannedAt: null
  })
  if (!participant) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Phong hoc khong ton tai hoac ban khong con trong phong.')
  }
  return participant
}

// [POST] /study-rooms
const create = async (hostId, payload) => {
  for (let attempt = 1; attempt <= ROOM_LIMITS.ROOM_CODE_RETRY_MAX; attempt += 1) {
    let room = null
    try {
      room = await studyRoomModel.create({
        ...payload,
        hostId,
        roomCode: generateRoomCode(),
        emptySince: new Date()
      })

      await reserveParticipant({
        roomId: room._id,
        userId: hostId,
        role: ROOM_ROLE.HOST
      })
      return room
    } catch (error) {
      if (room?._id) {
        await studyRoomModel.deleteOne({ _id: room._id })
      }

      const duplicateRoomCode = error?.code === 11000 && Boolean(error?.keyPattern?.roomCode)
      const duplicateActiveUser = error?.code === 11000 && String(error?.message).includes('one_active_room_per_user')

      if (duplicateActiveUser) {
        throw new ApiError(StatusCodes.CONFLICT, 'Bạn đang ở trong một phòng học.')
      }
      if (!duplicateRoomCode) throw error
    }
  }

  throw new ApiError(StatusCodes.CONFLICT, 'Không thể tạo mã phòng duy nhất. Vui lòng thử lại.')
}

// [GET] /study-rooms
const list = async ({ page, limit, keyword }) => {
  const filter = { visibility: ROOM_VISIBILITY.PUBLIC, status: ROOM_STATUS.OPEN }
  if (keyword) filter.title = { $regex: escapeRegex(keyword), $options: 'i' }

  const [items, total] = await Promise.all([
    studyRoomModel
      .find(filter)
      .populate('hostId', 'displayName avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    studyRoomModel.countDocuments(filter)
  ])

  return { items, pagination: { page, limit, total } }
}

// [POST] /study-rooms/join
const joinByCode = async (userId, roomCode) => {
  const room = await studyRoomModel.findOne({
    roomCode,
    status: ROOM_STATUS.OPEN
  })

  if (!room) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Mã phòng không hợp lệ.')
  }

  try {
    await reserveParticipant({ roomId: room._id, userId })
  } catch (error) {
    const activeRoomConflict = error?.code === 11000 && String(error?.message).includes('one_active_room_per_user')

    if (activeRoomConflict) {
      throw new ApiError(StatusCodes.CONFLICT, 'Bạn đang ở trong một phòng học khác.')
    }
    throw error
  }

  return room
}

// [GET] /study-rooms/:id
const getById = async (roomId, userId) => {
  const room = await findOpenRoom(roomId)
  await assertParticipant(roomId, userId)
  return room
}

// [GET] /study-rooms/:id/messages
const listMessages = async (roomId, userId, { before, limit }) => {
  await assertParticipant(roomId, userId)

  const filter = { roomId, deletedAt: null }
  if (before) filter.createdAt = { $lt: before }

  const messages = await roomMessageModel
    .find(filter)
    .populate('senderId', 'displayName avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return messages.reverse()
}

// [GET] /study-rooms/:id/leaderboard
const leaderboard = async (roomId, userId) => {
  await assertParticipant(roomId, userId)
  return roomParticipantModel
    .find({ roomId, bannedAt: null })
    .populate('userId', 'displayName avatar')
    .sort({ studySeconds: -1 })
    .limit(50)
    .lean()
}

// [POST] /study-rooms/:id/media-token
const mediaToken = async (roomId, userId, { deviceId, sessionId }) => {
  const room = await findOpenRoom(roomId)
  const [participant, user] = await Promise.all([
    assertActiveParticipant(roomId, userId),
    userModel.findById(userId).select('displayName').lean()
  ])
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Người dùng không tồn tại.')

  return roomMediaService.issueParticipantToken({
    room,
    user,
    participant,
    deviceId,
    sessionId
  })
}

const reservationExpiry = () => new Date(Date.now() + ROOM_LIMITS.JOIN_RESERVATION_SECONDS * 1000)

const reserveParticipant = async ({ roomId, userId, role = ROOM_ROLE.MEMBER }) => {
  const now = new Date()
  await roomParticipantModel.updateMany(
    { userId, leftAt: null, joinExpiresAt: { $lt: now } },
    { $set: { leftAt: now, joinExpiresAt: null } }
  )

  const existing = await roomParticipantModel.findOne({ roomId, userId })
  if (existing?.bannedAt) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn đã bị chặn khỏi phòng này.')
  }

  if (existing?.leftAt === null && existing.joinExpiresAt === null) {
    return existing
  }
  if (existing) {
    existing.joinedAt = now
    existing.joinExpiresAt = reservationExpiry()
    existing.leftAt = null
    existing.kickedAt = null
    await existing.save()
    return existing
  }

  return roomParticipantModel.create({
    roomId,
    userId,
    role,
    joinedAt: now,
    joinExpiresAt: reservationExpiry()
  })
}

export default {
  create,
  list,
  joinByCode,
  getById,
  listMessages,
  leaderboard,
  mediaToken,
  assertParticipant,
  assertActiveParticipant,
  findOpenRoom
}
