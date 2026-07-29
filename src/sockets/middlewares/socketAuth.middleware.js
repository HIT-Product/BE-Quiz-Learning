import mongoose from 'mongoose'

import { ROOM_LIMITS } from '../../constants/index.js'
import { sessionModel } from '../../models/index.js'
import { jwtUtils } from '../../utils/index.js'

const validDeviceId = (value) => {
  if (typeof value !== 'string') return false
  const deviceId = value.trim()
  return deviceId.length >= ROOM_LIMITS.DEVICE_ID_MIN && deviceId.length <= ROOM_LIMITS.DEVICE_ID_MAX
}

const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token
    const deviceId = socket.handshake.auth?.deviceId
    if (!token || !validDeviceId(deviceId)) return next(new Error('UNAUTHORIZED'))

    const payload = jwtUtils.verifyAccessToken(token)
    if (!mongoose.isValidObjectId(payload._id) || !mongoose.isValidObjectId(payload.sessionId)) {
      return next(new Error('UNAUTHORIZED'))
    }

    const sessionExists = await sessionModel.exists({
      _id: payload.sessionId,
      userId: payload._id,
      expiresAt: { $gt: new Date() }
    })
    if (!sessionExists) return next(new Error('UNAUTHORIZED'))

    socket.user = {
      _id: payload._id,
      email: payload.email,
      sessionId: payload.sessionId
    }
    socket.data.userId = String(payload._id)
    socket.data.deviceId = deviceId.trim()
    socket.data.generation = null
    socket.data.roomId = null
    next()
  } catch {
    next(new Error('UNAUTHORIZED'))
  }
}

export default socketAuthMiddleware
