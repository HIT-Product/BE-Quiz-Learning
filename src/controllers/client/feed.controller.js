import { StatusCodes } from 'http-status-codes'

import { feedService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /feed
const getFeed = catchAsync(async (req, res) => {
  const data = await feedService.getFeed(req.user._id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay feed hoat dong thanh cong.', data))
})

export default { getFeed }
