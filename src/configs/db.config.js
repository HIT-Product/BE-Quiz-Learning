import mongoose from 'mongoose'

import { envConfig } from './index.js'
import { logger } from '../utils/index.js'

const connectDB = async () => {
  try {
    await mongoose.connect(envConfig.mongo.uri)
    logger.info('Connected to the database')
  } catch (error) {
    logger.error(`Failed to connect to the database: ${error.message}`)
    throw error
  }
}

export default connectDB
