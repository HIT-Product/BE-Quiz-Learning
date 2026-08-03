import multer from 'multer'
import { StatusCodes } from 'http-status-codes'

import ApiError from '../utils/ApiError.js'

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const avatarFileFilter = (_req, file, callback) => {
  if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
    return callback(new ApiError(StatusCodes.BAD_REQUEST, 'Avatar phai la anh JPEG, PNG, WebP hoac GIF.'))
  }

  return callback(null, true)
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_SIZE_BYTES,
    files: 1
  },
  fileFilter: avatarFileFilter
})

const uploadAvatar = (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error) => {
    if (!error) {
      return next()
    }

    if (error instanceof ApiError) {
      return next(error)
    }

    const isTooLarge = error.code === 'LIMIT_FILE_SIZE'
    const statusCode = isTooLarge ? StatusCodes.CONTENT_TOO_LARGE : StatusCodes.BAD_REQUEST
    const message = isTooLarge ? 'Avatar khong duoc vuot qua 5 MB.' : 'File avatar khong hop le.'

    return next(new ApiError(statusCode, message))
  })
}

export { AVATAR_MAX_SIZE_BYTES, AVATAR_MIME_TYPES, avatarFileFilter }
export default uploadAvatar
