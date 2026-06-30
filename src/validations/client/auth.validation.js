import Joi from 'joi'

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
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    newPassword: Joi.string().min(6).required()
  })
}

const resendForgotPasswordOtp = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
}

const requestRegisterOtp = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    displayName: Joi.string().trim().required()
  })
}

const verifyRegisterOtp = {
  body: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
  })
}

const resendRegisterOtp = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
}

export default {
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  resendForgotPasswordOtp,
  requestRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp
}
