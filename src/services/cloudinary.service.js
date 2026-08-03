import { StatusCodes } from 'http-status-codes'

import cloudinary, { isCloudinaryConfigured } from '../configs/cloudinary.config.js'
import ApiError from '../utils/ApiError.js'

const AVATAR_FOLDER = 'hit-product/avatars'
const getAvatarPublicId = (userId) => `${AVATAR_FOLDER}/${userId}`

const ensureConfigured = () => {
  if (!isCloudinaryConfigured) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Cloudinary chua duoc cau hinh.')
  }
}

const uploadAvatar = async (buffer, userId) => {
  ensureConfigured()

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: getAvatarPublicId(userId),
        resource_type: 'image',
        overwrite: true,
        invalidate: true
      },
      (error, result) => {
        if (error) {
          return reject(error)
        }

        return resolve(result)
      }
    )

    stream.end(buffer)
  })
}

const deleteAvatar = async (userId) => {
  ensureConfigured()

  return cloudinary.uploader.destroy(getAvatarPublicId(userId), {
    resource_type: 'image',
    invalidate: true
  })
}

export { AVATAR_FOLDER, getAvatarPublicId }
export default { uploadAvatar, deleteAvatar }
