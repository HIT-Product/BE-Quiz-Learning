import { roomSessionService } from '../services/index.js'
import { socketError } from './socketHandler.js'

const assertCurrentRoomSession = async (socket, roomId) => {
  if (String(socket.data.roomId || '') !== String(roomId || '')) {
    throw socketError('NOT_PARTICIPANT', 'Bạn không ở trong phòng này.')
  }
  await roomSessionService.assertDeviceOwner({
    userId: socket.user._id,
    roomId,
    socketId: socket.id,
    deviceId: socket.data.deviceId,
    generation: socket.data.generation
  })
}

export { assertCurrentRoomSession }
