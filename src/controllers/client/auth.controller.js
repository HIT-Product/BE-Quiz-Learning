import { StatusCodes } from 'http-status-codes'
import { catchAsync, response, ApiError, refreshCookieOptions } from '../../utils/index.js'
import { authService } from '../../services/client/index.js'

const register = catchAsync(async (req, res) => {
  const { email, password, displayName } = req.body

  const { accessToken, refreshToken } = await authService.register({ email, password, displayName })

  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
  return res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Đăng ký thành công.', { accessToken }))
})

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body

  const { accessToken, refreshToken } = await authService.login({ email, password })

  res.cookie('refreshToken', refreshToken, refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng nhập thành công.', { accessToken }))
})

const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'refreshToken không tồn tại.')
  }

  const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(token)

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cấp token mới thành công.', { accessToken }))
})

const logout = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken
  if (token) {
    await authService.logout(token)
  }

  res.clearCookie('refreshToken', refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất thành công.'))
})

const logoutAll = catchAsync(async (req, res) => {
  await authService.logoutAll(req.user._id)

  res.clearCookie('refreshToken', refreshCookieOptions)
  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất tất cả thiết bị thành công.'))
})

export default { register, login, refreshToken, logout, logoutAll }
