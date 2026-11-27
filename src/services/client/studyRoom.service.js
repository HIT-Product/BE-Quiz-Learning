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

const activeParticipantFilter = (roomId, userId) => ({
  roomId,
  userId,
  leftAt: null,
  kickedAt: null,
  bannedAt: null,
  $or: [{ joinExpiresAt: null }, { joinExpiresAt: { $gt: new Date() } }]
})

const assertActiveParticipant = async (roomId, userId) => {
  const participant = await roomParticipantModel.findOne(activeParticipantFilter(roomId, userId))
  if (!participant) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Phong hoc khong ton tai hoac ban khong con trong phong.')
  }
  return participant
}

const activateParticipant = async (roomId, userId) => {
  const result = await roomParticipantModel.updateOne(activeParticipantFilter(roomId, userId), {
    $set: { joinExpiresAt: null }
  })
  if (!result.matchedCount) throw new ApiError(StatusCodes.NOT_FOUND, 'Lượt giữ chỗ đã hết hạn hoặc đã bị hủy.')
}

const cancelReservation = async (roomId, userId, reservationExpiresAt) => {
  await roomParticipantModel.updateOne(
    { roomId, userId, leftAt: null, joinExpiresAt: reservationExpiresAt },
    { $set: { leftAt: new Date(), joinExpiresAt: null } }
  )
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
  const participant = await assertParticipant(roomId, userId)
  return { ...room.toObject(), reservationExpiresAt: participant.joinExpiresAt }
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

const getSummary = async (roomId, userId) => {
  const participant = await assertParticipant(roomId, userId)
  const room = await studyRoomModel
    .findById(roomId)
    .select('title status createdAt closedAt settings.leaderboardEnabled')
    .lean()
  if (!room) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy phòng học.')
  }
  if (room.status !== ROOM_STATUS.CLOSED) {
    throw new ApiError(StatusCodes.CONFLICT, 'Phòng học chưa kết thúc.')
  }

  const participants = { roomId: participant.roomId, bannedAt: null }
  const showLeaderboard = room.settings?.leaderboardEnabled !== false
  const [[stats], leaders] = await Promise.all([
    roomParticipantModel.aggregate([
      { $match: participants },
      {
        $group: {
          _id: null,
          participantCount: { $sum: 1 },
          totalSeconds: { $sum: '$studySeconds' },
          personalSeconds: {
            $sum: { $cond: [{ $eq: ['$userId', participant.userId] }, '$studySeconds', 0] }
          }
        }
      },
      { $project: { _id: 0 } }
    ]),
    showLeaderboard
      ? roomParticipantModel
          .find(participants)
          .select('userId studySeconds')
          .populate('userId', 'displayName avatarUrl')
          .sort({ studySeconds: -1, _id: 1 })
          .limit(5)
          .lean()
      : null
  ])

  return {
    room: { _id: room._id, title: room.title, createdAt: room.createdAt, closedAt: room.closedAt },
    stats: stats ?? { participantCount: 0, totalSeconds: 0, personalSeconds: 0 },
    leaderboard: leaders
  }
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
    const renewed = await roomParticipantModel.findOneAndUpdate(
      { _id: existing._id, bannedAt: null, $or: [{ leftAt: { $ne: null } }, { joinExpiresAt: { $ne: null } }] },
      { $set: { joinedAt: now, joinExpiresAt: reservationExpiry(), leftAt: null, kickedAt: null } },
      { returnDocument: 'after' }
    )
    return renewed ?? (await assertActiveParticipant(roomId, userId))
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
  cancelReservation,
  activateParticipant,
  getById,
  listMessages,
  leaderboard,
  getSummary,
  mediaToken,
  assertParticipant,
  assertActiveParticipant,
  findOpenRoom
}
