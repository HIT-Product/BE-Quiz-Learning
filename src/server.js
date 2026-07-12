import path from 'path'
import cors from 'cors'
import http from 'http'
import express from 'express'
import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import { StatusCodes } from 'http-status-codes'

import './configs/google.config.js'
import { APP_LIMITS, APP_PATH, APP_TRUST_PROXY, APP_VIEW } from './constants/index.js'
import router from './routers/index.js'
import { logger, response } from './utils/index.js'
import { envConfig, connectDB, passport } from './configs/index.js'
import { errorMiddleware, morganMiddleware } from './middlewares/index.js'

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.set('views', `${__dirname}/views`)
app.set(APP_VIEW.ENGINE_KEY, APP_VIEW.ENGINE)

app.use(express.static(path.join(__dirname, '..', APP_PATH.PUBLIC_DIR)))

app.use(
  cors({
    origin: envConfig.server.clientUrl || 'http://localhost:3000',
    credentials: true
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(passport.initialize())

app.set('trust proxy', APP_TRUST_PROXY)

if (envConfig.server.nodeEnv === 'development') {
  app.use(morganMiddleware)
  mongoose.set('debug', true)
  logger.info('Running in development mode')
}

app.use(APP_PATH.API_V1, router)

app.get(APP_PATH.ROOT, (req, res) => {
  res.send('Backend Server for Quiz Learning is running!')
})

app.all(/(.*)/, (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json(response(StatusCodes.NOT_FOUND, 'Không tìm thấy tài nguyên.'))
})

app.use(errorMiddleware.errorConverter)
app.use(errorMiddleware.errorHandler)

app.use(express.json({ limit: APP_LIMITS.BODY_SIZE }))
app.use(express.urlencoded({ extended: true, limit: APP_LIMITS.BODY_SIZE }))

connectDB()
  .then(() => {
    app.listen(envConfig.server.port, () => {
      logger.info(`Server is running on ${envConfig.server.host}:${envConfig.server.port}`)
    })
  })
  .catch((error) => {
    logger.error('Failed to connect to the database:', error)
    process.exit(1)
  })
