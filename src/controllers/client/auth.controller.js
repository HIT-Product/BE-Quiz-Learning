import { StatusCodes } from 'http-status-codes'

import { envConfig } from '../../configs/index.js'
import { authService } from '../../services/client/index.js'
import { catchAsync, response, ApiError, refreshCookieOptions } from '../../utils/index.js'
// [POST] /auth/login
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body

  const { accessToken, refreshToken } = await authService.login({ email, password })

  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng nhập thành công.', { accessToken }))
})
// [POST] /auth/refresh-token
const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'refreshToken không tồn tại.')
  }

  const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(token)

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cấp token mới thành công.', { accessToken }))
})
// [POST] /auth/logout
const logout = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken
  if (token) {
    await authService.logout(token)
  }

  res.clearCookie('refreshToken', refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất thành công.'))
})
// [POST] /auth/logout-all
const logoutAll = catchAsync(async (req, res) => {
  await authService.logoutAll(req.user._id)

  res.clearCookie('refreshToken', refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất tất cả thiết bị thành công.'))
})
// [POST] /auth/change-password
const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword, logoutOtherDevices = true } = req.body

  const result = await authService.changePassword({
    userId: req.user._id,
    currentSessionId: req.user.sessionId,
    oldPassword,
    newPassword,
    logoutOtherDevices
  })

  const message = result.loggedOutOtherDevices
    ? 'Đổi mật khẩu thành công. Các thiết bị khác đã được đăng xuất.'
    : 'Đổi mật khẩu thành công.'

  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, message, result))
})
// [POST] /auth/forgot-password
const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body)
  return res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Neu email ton tai, ma OTP da duoc gui. Vui long kiem tra hop thu.'))
})
// [POST] /auth/reset-password
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body)
  return res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Dat lai mat khau thanh cong. Vui long dang nhap lai.'))
})

// [POST] /auth/forgot-password/resend
const resendForgotPasswordOtp = catchAsync(async (req, res) => {
  await authService.resendForgotPasswordOtp(req.body)
  return res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Neu email ton tai, ma OTP moi da duoc gui. Vui long kiem tra hop thu.'))
})

// [GET] /auth/google-callback
const googleCallback = catchAsync(async (req, res) => {
  try {
    const { accessToken, refreshToken } = await authService.googleLogin(req.user)

    res.cookie('refreshToken', refreshToken, refreshCookieOptions)

    return res.redirect(
      envConfig.server.clientUrl + '/auth/login?success=true&accessToken=' + encodeURIComponent(accessToken)
    )
  } catch (error) {
    return res.redirect(
      envConfig.server.clientUrl + '/auth/login?success=false&message=' + encodeURIComponent(error.message)
    )
  }
})

// [POST] /auth/register
const requestRegisterOtp = catchAsync(async (req, res) => {
  const data = await authService.requestRegisterOtp(req.body)
  return res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Ma OTP da duoc gui ve email. Vui long kiem tra hop thu.', data))
})

// [POST] /auth/register/verify-otp
const verifyRegisterOtp = catchAsync(async (req, res) => {
  const { accessToken, refreshToken } = await authService.verifyRegisterOtp(req.body)

  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
  return res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Đăng ký thành công.', { accessToken }))
})

// [POST] /auth/register/resend-otp
const resendRegisterOtp = catchAsync(async (req, res) => {
  const data = await authService.resendRegisterOtp(req.body)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Ma OTP moi da duoc gui ve email.', data))
})

export default {
  login,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  resendForgotPasswordOtp,
  googleCallback,
  requestRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp
}
