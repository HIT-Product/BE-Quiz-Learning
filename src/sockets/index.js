import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import { envConfig } from '../configs/index.js'
import { createRedisClient } from '../configs/redis.config.js'
import { logger } from '../utils/index.js'
import socketAuthMiddleware from './middlewares/socketAuth.middleware.js'
import registerRoomHandlers from './handlers/room.handler.js'
import registerChatHandlers from './handlers/chat.handler.js'
import registerPomodoroHandlers from './handlers/pomodoro.handler.js'

let io = null

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: envConfig.server.nodeEnv === 'development' ? true : envConfig.server.clientUrl,
      credentials: true
    },
    // Giới hạn payload.
    maxHttpBufferSize: 1e4,
    pingInterval: 25000,
    pingTimeout: 20000
  })

  // Dùng khi chạy nhiều instance.
  // const pubClient = createRedisClient()
  // const subClient = pubClient.duplicate()
  // io.adapter(createAdapter(pubClient, subClient))

  const nsp = io.of('/study-rooms')
  nsp.use(socketAuthMiddleware)

  nsp.on('connection', (socket) => {
    logger.info(`Socket connected: user=${socket.user._id} sid=${socket.id}`)
    registerRoomHandlers(nsp, socket)
    registerChatHandlers(nsp, socket)
    registerPomodoroHandlers(nsp, socket)

    socket.on('error', (err) => logger.error(`Socket error: ${err.message}`))
  })

  return io
}

const getIO = () => {
  if (!io) throw new Error('Socket.io chưa được khởi tạo')
  return io
}

export { initSocket, getIO }
