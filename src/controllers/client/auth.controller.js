import { StatusCodes } from 'http-status-codes'
import { catchAsync, response } from '../../utils/index.js'
import { authService } from '../../services/client/index.js'

const register = catchAsync(async (req, res) => {
  const { email, password, displayName } = req.body

  const user = await authService.register({ email, password, displayName })

  return res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Đăng ký thành công.', user))
})

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body

  const result = await authService.login({ email, password })

  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng nhập thành công.', result))
})

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body

  const result = await authService.refreshToken(refreshToken)

  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cấp token mới thành công.', result))
})

const logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body

  await authService.logout(refreshToken)

  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất thành công.'))
})

const logoutAll = catchAsync(async (req, res) => {
  await authService.logoutAll(req.user._id)

  return res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Đăng xuất tất cả thiết bị thành công.'))
})

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll
}
