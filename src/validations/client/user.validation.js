import Joi from 'joi'

import {
  ACTIVITY_VISIBILITY,
  FRIEND_REQUEST_POLICY,
  USER_LIMITS,
  USERNAME_PATTERN
} from '../../constants/index.js'

const updateProfile = {
  body: Joi.object({
    displayName: Joi.string().trim().max(USER_LIMITS.DISPLAY_NAME_MAX_LENGTH),
    defaultQuizSize: Joi.number().integer().min(USER_LIMITS.QUIZ_SIZE_MIN).max(USER_LIMITS.QUIZ_SIZE_MAX)
  }).min(1)
}

const updateUsername = {
  body: Joi.object({
    username: Joi.string()
      .trim()
      .lowercase()
      .min(USER_LIMITS.USERNAME_MIN_LENGTH)
      .max(USER_LIMITS.USERNAME_MAX_LENGTH)
      .pattern(USERNAME_PATTERN)
      .required()
  })
}

const usernameAvailable = {
  query: Joi.object({
    username: Joi.string().trim().lowercase().required()
  })
}

const updatePrivacy = {
  body: Joi.object({
    activityVisibility: Joi.string().valid(...Object.values(ACTIVITY_VISIBILITY)),
    friendRequestPolicy: Joi.string().valid(...Object.values(FRIEND_REQUEST_POLICY))
  }).min(1)
}

export default {
  updateProfile,
  updateUsername,
  usernameAvailable,
  updatePrivacy
}
