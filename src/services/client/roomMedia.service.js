import { RoomServiceClient, TrackSource } from 'livekit-server-sdk'

import { envConfig } from '../../configs/index.js'
import { logger } from '../../utils/index.js'

const apiUrl = String(envConfig.livekit?.url || '')
  .replace(/^wss:/, 'https:')
  .replace(/^ws:/, 'http:')

const client =
  apiUrl && envConfig.livekit?.apiKey && envConfig.livekit?.apiSecret
    ? new RoomServiceClient(apiUrl, envConfig.livekit.apiKey, envConfig.livekit.apiSecret)
    : null

const assertConfigured = () => {
  if (!client) throw new Error('LiveKit chua duoc cau hinh.')
  return client
}

const ignoreMissing = (error) => {
  const message = String(error?.message || '').toLowerCase()
  if (error?.code === 5 || message.includes('not found') || message.includes('does not exist')) return
  throw error
}

const removeParticipant = async (roomId, userId) => {
  try {
    await assertConfigured().removeParticipant(String(roomId), String(userId))
  } catch (error) {
    ignoreMissing(error)
  }
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
  const participants = await service.listParticipants(String(roomId))
  const jobs = []
  for (const participant of participants) {
    if (exceptUserId && String(participant.identity) === String(exceptUserId)) continue
    for (const track of participant.tracks || []) {
      if (track.source === TrackSource.MICROPHONE && !track.muted) {
        jobs.push(service.mutePublishedTrack(String(roomId), participant.identity, track.sid, true))
      }
    }
  }
  await Promise.allSettled(jobs)
}

const updateMicrophonePermission = async ({ roomId, userId, allowMicrophone, allowCamera = true }) => {
  const sources = []
  if (allowCamera) sources.push(TrackSource.CAMERA)
  if (allowMicrophone) sources.push(TrackSource.MICROPHONE)

  try {
    await assertConfigured().updateParticipant(String(roomId), String(userId), undefined, {
      canSubscribe: true,
      canPublish: sources.length > 0,
      canPublishData: true,
      canPublishSources: sources
    })
  } catch (error) {
    ignoreMissing(error)
  }
}

const removeParticipantForHandoff = async (roomId, userId) => {
  try {
    await removeParticipant(roomId, userId)
  } catch (error) {
    logger.warn(`LiveKit handoff cleanup failed: room=${roomId} user=${userId} error=${error.message}`)
  }
}

export default {
  removeParticipant,
  deleteRoom,
  muteAllMicrophones,
  updateMicrophonePermission,
  removeParticipantForHandoff
}
