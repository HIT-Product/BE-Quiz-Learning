import { customAlphabet } from 'nanoid'
import { StatusCodes } from 'http-status-codes'
import { AccessToken, TrackSource } from 'livekit-server-sdk'

import { envConfig, redisClient } from '../../configs/index.js'
import { studyRoomModel, roomParticipantModel, roomMessageModel } from '../../models/index.js'
import { ApiError, escapeRegex } from '../../utils/index.js'
import { ROOM_STATUS, ROOM_ROLE, ROOM_VISIBILITY, ROOM_LIMITS, ROOM_REDIS_KEY } from '../../constants/index.js'

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

const markStaleParticipantLeft = async (participant, userId) => {
  await Promise.all([
    roomParticipantModel.updateOne({ _id: participant._id, leftAt: null }, { $set: { leftAt: new Date() } }),
    redisClient.hdel(ROOM_REDIS_KEY.PRESENCE(participant.roomId), String(userId))
  ])
}

const hasLiveRoomSocket = async (nsp, roomId, userId) => {
  if (!nsp) return null
  const sockets = await nsp.in(`room:${roomId}`).fetchSockets()
  return sockets.some((socket) => String(socket.data?.userId || socket.user?._id) === String(userId))
}

const findActiveOpenRoomForUser = async (userId, nsp = null) => {
  const participant = await roomParticipantModel
    .findOne({ userId, leftAt: null, bannedAt: null })
    .select('_id roomId')
    .lean()
  if (!participant) return null

  const room = await studyRoomModel.findOne({ _id: participant.roomId, status: ROOM_STATUS.OPEN }).lean()
  if (!room) {
    await markStaleParticipantLeft(participant, userId)
    return null
  }

  const isPresent = await redisClient.hexists(ROOM_REDIS_KEY.PRESENCE(participant.roomId), String(userId))
  if (!isPresent) {
    await markStaleParticipantLeft(participant, userId)
    return null
  }

  const hasSocket = await hasLiveRoomSocket(nsp, participant.roomId, userId)
  if (hasSocket === false) {
    await markStaleParticipantLeft(participant, userId)
    return null
  }

  return room
}
// [POST] /study-rooms
const create = async (hostId, payload, nsp = null) => {
  const activeRoom = await findActiveOpenRoomForUser(hostId, nsp)
  if (activeRoom) {
    throw new ApiError(StatusCodes.CONFLICT, 'Ban dang o trong mot phong hoc.')
  }

  for (let attempt = 1; attempt <= ROOM_LIMITS.ROOM_CODE_RETRY_MAX; attempt += 1) {
    let room = null
    try {
      room = await studyRoomModel.create({ ...payload, hostId, roomCode: generateRoomCode() })
      await roomParticipantModel.create({ roomId: room._id, userId: hostId, role: ROOM_ROLE.HOST })
      return room
    } catch (error) {
      // Hoàn tác nếu tạo participant lỗi.
      if (room?._id) await studyRoomModel.deleteOne({ _id: room._id })

      const duplicateRoomCode = error?.code === 11000 && error?.keyPattern?.roomCode
      const duplicateActiveUser = error?.code === 11000 && error?.message?.includes('one_active_room_per_user')
      if (duplicateActiveUser) {
        throw new ApiError(StatusCodes.CONFLICT, 'Ban dang o trong mot phong hoc.')
      }
      if (!duplicateRoomCode || attempt === ROOM_LIMITS.ROOM_CODE_RETRY_MAX) throw error
    }
  }

  throw new ApiError(StatusCodes.CONFLICT, 'Khong the tao ma phong duy nhat. Vui long thu lai.')
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
const joinByCode = async (userId, roomCode, nsp = null) => {
  const room = await studyRoomModel.findOne({ roomCode, status: ROOM_STATUS.OPEN })
  if (!room) {
    // Không làm lộ trạng thái phòng.
    throw new ApiError(StatusCodes.NOT_FOUND, 'Mã phòng không hợp lệ.')
  }

  const existing = await roomParticipantModel.findOne({ roomId: room._id, userId })
  if (existing?.bannedAt) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn đã bị chặn khỏi phòng này.')
  }

  const activeRoom = await findActiveOpenRoomForUser(userId, nsp)
  if (activeRoom && String(activeRoom._id) !== String(room._id)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Ban dang o trong mot phong hoc khac. Hay roi phong hien tai truoc khi tham gia phong moi.'
    )
  }
  // Capacity được kiểm tra ở socket.

  if (existing) {
    existing.leftAt = null
    existing.kickedAt = null
    await existing.save()
  } else {
    await roomParticipantModel.create({ roomId: room._id, userId })
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
  const participant = await assertActiveParticipant(roomId, userId)
  const room = await findOpenRoom(roomId)
  const activeDevice = await redisClient.get(ROOM_REDIS_KEY.ACTIVE_DEVICE(userId))

  let active = null
  try {
    active = activeDevice ? JSON.parse(activeDevice) : null
  } catch {
    active = null
  }

  if (
    !active ||
    String(active.roomId) !== String(roomId) ||
    String(active.deviceId) !== String(deviceId) ||
    String(active.sessionId) !== String(sessionId)
  ) {
    throw new ApiError(StatusCodes.CONFLICT, 'Phien phong hoc dang hoat dong tren thiet bi khac.')
  }

  if (!envConfig.livekit?.url || !envConfig.livekit?.apiKey || !envConfig.livekit?.apiSecret) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'LiveKit chua duoc cau hinh.')
  }

  const isHost = String(room.hostId) === String(userId) || participant.role === ROOM_ROLE.HOST
  const publishSources = []
  if (room.settings?.cameraAllowed !== false) publishSources.push(TrackSource.CAMERA)
  if (room.settings?.micAllowed !== false && (!room.settings?.micLocked || isHost)) {
    publishSources.push(TrackSource.MICROPHONE)
  }

  const token = new AccessToken(envConfig.livekit.apiKey, envConfig.livekit.apiSecret, {
    identity: String(userId),
    ttl: '10m',
    metadata: JSON.stringify({
      userId: String(userId),
      deviceId: String(deviceId),
      sessionId: String(sessionId)
    })
  })

  token.addGrant({
    room: String(roomId),
    roomJoin: true,
    canSubscribe: true,
    canPublish: publishSources.length > 0,
    canPublishData: true,
    canPublishSources: publishSources
  })

  return { token: await token.toJwt(), url: envConfig.livekit.url }
}
// [PATCH] /study-rooms/:id/close
const close = async (roomId, userId) => {
  const room = await findOpenRoom(roomId)
  if (!room.hostId.equals(userId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Chỉ chủ phòng mới được đóng phòng.')
  }
  room.status = ROOM_STATUS.CLOSED
  room.closedAt = new Date()
  await room.save()
  return room
}

export default {
  create,
  list,
  joinByCode,
  getById,
  listMessages,
  leaderboard,
  mediaToken,
  close,
  assertParticipant,
  assertActiveParticipant,
  findOpenRoom
}
