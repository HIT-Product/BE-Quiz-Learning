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

const changePassword = {
  body: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
    logoutOtherDevices: Joi.boolean().default(true)
  })
}

const forgotPassword = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
}

const resetPassword = {
  body: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string().min(6).required()
  })
}

export default {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword
}
