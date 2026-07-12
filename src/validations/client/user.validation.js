import Joi from 'joi'

import { USER_LIMITS } from '../../constants/index.js'

const updateProfile = {
  body: Joi.object({
    displayName: Joi.string().trim().max(USER_LIMITS.DISPLAY_NAME_MAX_LENGTH),
    avatarUrl: Joi.string().uri().allow(null, ''),
    defaultQuizSize: Joi.number().integer().min(USER_LIMITS.QUIZ_SIZE_MIN).max(USER_LIMITS.QUIZ_SIZE_MAX)
  }).min(1)
}

export default {
  updateProfile
}
