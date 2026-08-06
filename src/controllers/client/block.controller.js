import { StatusCodes } from 'http-status-codes'

import { blockService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [POST] /blocks
const blockUser = catchAsync(async (req, res) => {
  const data = await blockService.blockUser(req.user._id, req.body.userId)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Da block nguoi dung.', data))
})

// [DELETE] /blocks/:id
const unblockUser = catchAsync(async (req, res) => {
  await blockService.unblockUser(req.user._id, req.params.id)
  res.status(StatusCodes.NO_CONTENT).send()
})

// [GET] /blocks
const listBlocked = catchAsync(async (req, res) => {
  const data = await blockService.listBlocked(req.user._id, req.query)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lay danh sach block thanh cong.', data))
})

export default { blockUser, unblockUser, listBlocked }
