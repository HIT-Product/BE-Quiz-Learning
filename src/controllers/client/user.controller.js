import { StatusCodes } from 'http-status-codes'
import { userService } from '../../services/client/index.js'
import { ApiError, catchAsync, response } from '../../utils/index.js'

const example = catchAsync(async (req, res) => {
  const { message } = userService.example()

  res.status(StatusCodes.OK).json(response(StatusCodes.OK, message))
})

export default {
  example
}
