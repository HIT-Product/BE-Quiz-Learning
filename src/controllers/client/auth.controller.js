import { StatusCodes } from 'http-status-codes'

import { envConfig } from '../../configs/index.js'
import { authService } from '../../services/client/index.js'
import { catchAsync, response, ApiError, refreshCookieOptions } from '../../utils/index.js'
// === Chức năng: Đăng ký tài khoản ===
const register = catchAsync(async (req, res) => {
  const { email, password, displayName } = req.body

  const { accessToken, refreshToken } = await authService.register({ email, password, displayName })

  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
  return res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Đăng ký thành công.', { accessToken }))
})
// === Chức năng: Đăng nhập bằng email và mật khẩu ===
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body

  const { accessToken, refreshToken } = await authService.login({ email, password })

  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng nhập thành công.', { accessToken }))
})
// === Chức năng: Làm mới access token ===
const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'refreshToken không tồn tại.')
  }

  const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(token)

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cấp token mới thành công.', { accessToken }))
})
// === Chức năng: Đăng xuất phiên hiện tại ===
const logout = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken
  if (token) {
    await authService.logout(token)
  }

  res.clearCookie('refreshToken', refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất thành công.'))
})
// === Chức năng: Đăng xuất khỏi tất cả thiết bị ===
const logoutAll = catchAsync(async (req, res) => {
  await authService.logoutAll(req.user._id)

  res.clearCookie('refreshToken', refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất tất cả thiết bị thành công.'))
})
// === Chức năng: Đổi mật khẩu ===
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
// === Chức năng: Gửi OTP khôi phục mật khẩu ===
const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body)
  return res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Neu email ton tai, ma OTP da duoc gui. Vui long kiem tra hop thu.'))
})
// === Chức năng: Đặt lại mật khẩu bằng OTP ===
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body)
  return res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Dat lai mat khau thanh cong. Vui long dang nhap lai.'))
})

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

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
  googleCallback
}
