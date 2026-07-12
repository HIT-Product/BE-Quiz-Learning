import Joi from 'joi'

import { AUTH_LIMITS, AUTH_PATTERN, USER_LIMITS } from '../../constants/index.js'

const login = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
}

const changePassword = {
  body: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(AUTH_LIMITS.PASSWORD_MIN_LENGTH).required(),
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
    otp: Joi.string().length(AUTH_LIMITS.OTP_LENGTH).pattern(AUTH_PATTERN.OTP).required(),
    newPassword: Joi.string().min(AUTH_LIMITS.PASSWORD_MIN_LENGTH).required()
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
    password: Joi.string().min(AUTH_LIMITS.PASSWORD_MIN_LENGTH).required(),
    displayName: Joi.string().trim().max(USER_LIMITS.DISPLAY_NAME_MAX_LENGTH).required()
  })
}

const verifyRegisterOtp = {
  body: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(AUTH_LIMITS.OTP_LENGTH).pattern(AUTH_PATTERN.OTP).required()
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
