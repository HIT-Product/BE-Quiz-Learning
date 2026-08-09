import path from 'path'
import { readFileSync } from 'node:fs'
import cors from 'cors'
import http from 'http'
import express from 'express'
import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import { StatusCodes } from 'http-status-codes'

import './configs/google.config.js'
import { initSocket } from './sockets/index.js'
import { emailQueue, pomodoroQueue, roomMaintenanceQueue } from './queues/index.js'
import { createPomodoroWorker } from './workers/pomodoro.worker.js'
import { APP_LIMITS, APP_PATH, APP_TRUST_PROXY, APP_VIEW, ROOM_MAINTENANCE_SCHEDULER_ID } from './constants/index.js'
import router from './routers/index.js'
import { logger, response } from './utils/index.js'
import { envConfig, connectDB, passport } from './configs/index.js'
import { redisClient } from './configs/redis.config.js'
import { errorMiddleware, morganMiddleware } from './middlewares/index.js'

const app = express()
const httpServer = http.createServer(app)
let io = null
let pomodoroWorker = null
let isReady = false
let isShuttingDown = false

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const swaggerDocument = JSON.parse(readFileSync(path.join(__dirname, '..', 'swagger', 'swagger.json'), 'utf8'))

app.set('views', `${__dirname}/views`)
app.set(APP_VIEW.ENGINE_KEY, APP_VIEW.ENGINE)

app.use(express.static(path.join(__dirname, '..', APP_PATH.PUBLIC_DIR)))
app.use(
  APP_PATH.API_DOCS,
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'HITProduct API Docs'
  })
)

app.use(
  cors({
    origin: envConfig.server.nodeEnv === 'development' ? true : envConfig.server.clientUrl,
    credentials: true
  })
)

app.use(express.json({ limit: APP_LIMITS.BODY_SIZE }))
app.use(
  express.urlencoded({
    extended: true,
    limit: APP_LIMITS.BODY_SIZE
  })
)
app.use(cookieParser())
app.use(passport.initialize())

app.set('trust proxy', APP_TRUST_PROXY)

if (envConfig.server.nodeEnv === 'development') {
  app.use(morganMiddleware)
  mongoose.set('debug', true)
  logger.info('Running in development mode')
}

app.get(APP_PATH.HEALTH_LIVE, (req, res) => {
  res.status(StatusCodes.OK).json({ status: 'ok' })
})

app.get(APP_PATH.HEALTH_READY, (req, res) => {
  const checks = {
    mongo: mongoose.connection.readyState === 1,
    redis: redisClient.status === 'ready'
  }
  const ready = isReady && Object.values(checks).every(Boolean)

  res.status(ready ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    status: ready ? 'ready' : 'not_ready',
    checks
  })
})

app.use(APP_PATH.API_V1, router)

app.get(APP_PATH.ROOT, (req, res) => {
  res.send('Backend Server for Quiz Learning is running!')
})

app.all(/(.*)/, (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json(response(StatusCodes.NOT_FOUND, 'Khong tim thay tai nguyen.'))
})

app.use(errorMiddleware.errorConverter)
app.use(errorMiddleware.errorHandler)

const startServer = async () => {
  await connectDB()

  // Xoa scheduler legacy, nhung khong drain queue de tranh mat job khi redeploy.
  await roomMaintenanceQueue.removeJobScheduler(ROOM_MAINTENANCE_SCHEDULER_ID.CLOSE_IDLE_ROOMS)

  io = initSocket(httpServer)
  const nsp = io.of('/study-rooms')
  pomodoroWorker = createPomodoroWorker(nsp)

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(envConfig.server.port, envConfig.server.host, resolve)
  })

  isReady = true
  logger.info(`Server is running on ${envConfig.server.host}:${envConfig.server.port}`)
}

const closeSocketServer = () =>
  new Promise((resolve) => {
    if (!io) return resolve()
    io.close(resolve)
  })

const closeHttpServer = () =>
  new Promise((resolve, reject) => {
    if (!httpServer.listening) return resolve()
    httpServer.close((error) => (error ? reject(error) : resolve()))
  })

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Shutdown timed out after ${timeoutMs}ms.`)), timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

const shutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return
  isShuttingDown = true
  isReady = false
  logger.info(`Received ${signal}, shutting down API...`)

  try {
    await closeSocketServer()
    await closeHttpServer()

    const resources = [emailQueue.close(), pomodoroQueue.close(), roomMaintenanceQueue.close()]
    if (pomodoroWorker) resources.push(pomodoroWorker.close())

    const results = await withTimeout(Promise.allSettled(resources), APP_LIMITS.SHUTDOWN_TIMEOUT_MS)
    const failed = results.find((result) => result.status === 'rejected')
    if (failed) throw failed.reason

    if (redisClient.status === 'ready') await redisClient.quit()
    else redisClient.disconnect()

    await mongoose.disconnect()
    logger.info('API shut down gracefully.')
    process.exit(exitCode)
  } catch (error) {
    logger.error(`Error while shutting down API: ${error.message}`)
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.stack || error.message}`)
  shutdown('uncaughtException', 1)
})
process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled rejection: ${error?.stack || error}`)
  shutdown('unhandledRejection', 1)
})

startServer().catch((error) => {
  logger.error(`Failed to start API: ${error.stack || error.message}`)
  shutdown('startupFailure', 1)
})
