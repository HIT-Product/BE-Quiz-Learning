import Joi from 'joi'

const register = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    displayName: Joi.string().required()
  })
}

const login = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
}

const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
}

export default {
  register,
  login,
  refreshToken
}
