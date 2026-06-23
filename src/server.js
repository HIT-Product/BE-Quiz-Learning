import path from 'path'
import cors from 'cors'
import http from 'http'
import express from 'express'
import mongoose from 'mongoose'
import cookieParser from 'cookie-parser'

import { fileURLToPath } from 'url'
import router from './routers/index.js'
import { logger, response } from './utils/index.js'
import { envConfig, connectDB } from './configs/index.js'
import { errorMiddleware, morganMiddleware } from './middlewares/index.js'
import { StatusCodes } from 'http-status-codes'
import { initWorkers } from './workers/index.js'

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.set('views', `${__dirname}/views`)
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, '..', 'public')))

app.use(
  cors({
    origin: envConfig.server.clientUrl || 'http://localhost:3000',
    credentials: true
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.set('trust proxy', true)

if (envConfig.server.nodeEnv === 'development') {
  app.use(morganMiddleware)
  mongoose.set('debug', true)
  logger.info('Running in development mode')
}

app.use('/api/v1', router)

app.get('/', (req, res) => {
  res.send('Backend Server for Quiz Learning is running!')
})

app.all(/(.*)/, (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json(response(StatusCodes.NOT_FOUND, 'Không tìm thấy tài nguyên.'))
})

app.use(errorMiddleware.errorConverter)
app.use(errorMiddleware.errorHandler)

connectDB()
  .then(() => {
    initWorkers()

    app.listen(envConfig.server.port, () => {
      logger.info(`Server is running on ${envConfig.server.host}:${envConfig.server.port}`)
    })
  })
  .catch((error) => {
    logger.error('Failed to connect to the database:', error)
    process.exit(1)
  })
