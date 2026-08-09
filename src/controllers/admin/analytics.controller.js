import { StatusCodes } from 'http-status-codes'

import { analyticsService } from '../../services/admin/index.js'
import { catchAsync, response } from '../../utils/index.js'

const getOverview = catchAsync(async (req, res) => {
  const data = await analyticsService.getOverview(req.validatedQuery)

  res
    .status(StatusCodes.OK)
    .json(response(StatusCodes.OK, 'Lấy thống kê quản trị thành công.', data))
})

export default { getOverview }
