import { StatusCodes } from 'http-status-codes'
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk'

import { envConfig } from '../../configs/index.js'
import { ROOM_ROLE } from '../../constants/index.js'
import { ApiError, logger } from '../../utils/index.js'
import roomSessionService from '../../sockets/services/roomSession.service.js'

const apiUrl = String(envConfig.livekit?.url || '')
  .replace(/^wss:/, 'https:')
  .replace(/^ws:/, 'http:')

const client =
  apiUrl && envConfig.livekit?.apiKey && envConfig.livekit?.apiSecret
    ? new RoomServiceClient(apiUrl, envConfig.livekit.apiKey, envConfig.livekit.apiSecret)
    : null

const assertConfigured = () => {
  if (!client) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Dịch vụ âm thanh và hình ảnh chưa được cấu hình.')
  }
  return client
}

const matchesUserIdentity = (identity, userId) => {
  const prefix = `${String(userId)}-`
  return String(identity) === String(userId) || String(identity).startsWith(prefix)
}

const listUserParticipants = async (roomId, userId) => {
  try {
    const participants = await assertConfigured().listParticipants(String(roomId))
    return participants.filter((participant) => matchesUserIdentity(participant.identity, userId))
  } catch (error) {
    ignoreMissing(error)
    return []
  }
}

const issueParticipantToken = async ({ room, user, participant, deviceId, sessionId }) => {
  assertConfigured()
  const activeDevice = await roomSessionService.getActiveDevice(user._id)
  const ownsLease =
    activeDevice &&
    String(activeDevice.roomId) === String(room._id) &&
    String(activeDevice.deviceId) === String(deviceId) &&
    String(activeDevice.sessionId) === String(sessionId)

  if (!ownsLease) {
    throw new ApiError(StatusCodes.CONFLICT, 'Phiên phòng học không còn hợp lệ. Hãy kết nối lại.')
  }

  const isHost = participant.role === ROOM_ROLE.HOST || String(room.hostId) === String(user._id)
  const sources = []
  if (room.settings?.cameraAllowed !== false) sources.push(TrackSource.CAMERA)
  if (room.settings?.micAllowed !== false && (isHost || !room.settings?.micLocked)) {
    sources.push(TrackSource.MICROPHONE)
  }
  if (room.settings?.screenShareAllowed !== false) {
    sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO)
  }

  const identity = `${String(user._id)}-${activeDevice.generation}-${activeDevice.socketId}`
  const token = new AccessToken(envConfig.livekit.apiKey, envConfig.livekit.apiSecret, {
    identity,
    name: user.displayName,
    ttl: '10m',
    metadata: JSON.stringify({
      userId: String(user._id),
      roomId: String(room._id),
      generation: Number(activeDevice.generation)
    })
  })
  token.addGrant({
    room: String(room._id),
    roomJoin: true,
    canSubscribe: true,
    canPublish: sources.length > 0,
    canPublishData: true,
    canPublishSources: sources
  })

  return {
    token: await token.toJwt(),
    url: envConfig.livekit.url,
    identity
  }
}

const ignoreMissing = (error) => {
  const message = String(error?.message || '').toLowerCase()
  if (error?.code === 5 || message.includes('not found') || message.includes('does not exist')) return
  throw error
}

const removeParticipant = async (roomId, userId) => {
  const service = assertConfigured()
  const participants = await listUserParticipants(roomId, userId)
  await Promise.allSettled(
    participants.map((participant) => service.removeParticipant(String(roomId), participant.identity))
  )
}

const deleteRoom = async (roomId) => {
  try {
    await assertConfigured().deleteRoom(String(roomId))
  } catch (error) {
    ignoreMissing(error)
  }
}

const muteAllMicrophones = async (roomId, exceptUserId = null) => {
  const service = assertConfigured()
  let participants
  try {
    participants = await service.listParticipants(String(roomId))
  } catch (error) {
    ignoreMissing(error)
    return
  }
  const jobs = []
  for (const participant of participants) {
    if (exceptUserId && matchesUserIdentity(participant.identity, exceptUserId)) continue
    for (const track of participant.tracks || []) {
      if (track.source === TrackSource.MICROPHONE && !track.muted) {
        jobs.push(service.mutePublishedTrack(String(roomId), participant.identity, track.sid, true))
      }
    }
  }
  await Promise.allSettled(jobs)
}

const updateMicrophonePermission = async ({
  roomId,
  userId,
  allowMicrophone,
  allowCamera = true,
  allowScreenShare = true
}) => {
  const sources = []
  if (allowCamera) sources.push(TrackSource.CAMERA)
  if (allowMicrophone) sources.push(TrackSource.MICROPHONE)
  if (allowScreenShare) sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO)

  const service = assertConfigured()
  const participants = await listUserParticipants(roomId, userId)
  await Promise.allSettled(
    participants.map((participant) =>
      service.updateParticipant(String(roomId), participant.identity, undefined, {
        canSubscribe: true,
        canPublish: sources.length > 0,
        canPublishData: true,
        canPublishSources: sources
      })
    )
  )
}

const removeParticipantForHandoff = async (roomId, userId) => {
  try {
    await removeParticipant(roomId, userId)
  } catch (error) {
    logger.warn(`LiveKit handoff cleanup failed: room=${roomId} user=${userId} error=${error.message}`)
  }
}

export default {
  issueParticipantToken,
  removeParticipant,
  deleteRoom,
  muteAllMicrophones,
  updateMicrophonePermission,
  removeParticipantForHandoff
}
