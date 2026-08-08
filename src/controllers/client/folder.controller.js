import { StatusCodes } from 'http-status-codes'

import { folderService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

// [GET] /folders
const list = catchAsync(async (req, res) => {
  const folders = await folderService.list(req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy danh sách thư mục thành công.', folders))
})

// [GET] /folders/:id
const getById = catchAsync(async (req, res) => {
  const folder = await folderService.getById(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy thư mục thành công.', folder))
})

// [POST] /folders
const create = catchAsync(async (req, res) => {
  const folder = await folderService.create(req.user._id, req.body)
  res.status(StatusCodes.CREATED).json(response(StatusCodes.CREATED, 'Tạo thư mục thành công.', folder))
})

// [PUT] /folders/:id
const update = catchAsync(async (req, res) => {
  const folder = await folderService.update(req.params.id, req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật thư mục thành công.', folder))
})

// [DELETE] /folders/:id
const remove = catchAsync(async (req, res) => {
  await folderService.remove(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Xóa thư mục thành công.'))
})

export default {
  list,
  getById,
  create,
  update,
  remove
}
