import fs from 'fs'
import path from 'path'
import winston from 'winston'
import { fileURLToPath } from 'url'

import { envConfig } from '../configs/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const logDir = path.resolve(__dirname, '../../logs')

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const isDev = envConfig.server.nodeEnv !== 'production'

const formats = [
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => `[${timestamp}] [${level}]: ${message || stack}`)
]

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(...formats),
  transports: [
    ...(isDev ? [new winston.transports.Console()] : []),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'info.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  ],
  exitOnError: false
})

export default logger
