import { v2 as cloudinary } from 'cloudinary'

import envConfig from './env.config.js'

const cloudinaryCredentials = {
  cloud_name: envConfig.cloudinary.cloudName,
  api_key: envConfig.cloudinary.apiKey,
  api_secret: envConfig.cloudinary.apiSecret
}

cloudinary.config({
  ...cloudinaryCredentials,
  secure: true
})

const isCloudinaryConfigured = Object.values(cloudinaryCredentials).every(Boolean)

export { isCloudinaryConfigured }
export default cloudinary
