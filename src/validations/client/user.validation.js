import Joi from 'joi'

const updateProfile = {
  body: Joi.object({
    displayName: Joi.string().trim().max(120),
    avatarUrl: Joi.string().uri().allow(null, ''),
    defaultQuizSize: Joi.number().integer().min(1).max(100)
  }).min(1) // it nhat mot truong de cap nhat
}

export default {
  updateProfile
}
