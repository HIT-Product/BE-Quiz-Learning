import { StatusCodes } from 'http-status-codes'

import { dashboardService } from '../../services/client/index.js'
import { catchAsync, response } from '../../utils/index.js'

const getOverview = catchAsync(async (req, res) => {
    const data = await dashboardService.getOverview(req.user._id)
    res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Lấy tổng quan học tập thành công.', data))
})

export default { getOverview }