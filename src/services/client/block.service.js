import { StatusCodes } from 'http-status-codes'

import { FRIENDSHIP_STATUS, SOCIAL_LIMITS } from '../../constants/index.js'
import {
    friendshipModel,
    userBlockModel,
    userModel
} from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { toPairKey } from '../../utils/pairKey.js'

const blockUser = async (blockerId, blockedId) => {
    if (String(blockerId) === String(blockedId)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Khong the block chinh minh.')
    }

    const target = await userModel.findById(blockedId).select('_id').lean()
    if (!target) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay nguoi dung.')

    const existing = await userBlockModel.exists({ blockerId, blockedId })
    if (existing) throw new ApiError(StatusCodes.CONFLICT, 'Da block nguoi dung nay roi.')

    const blockedCount = await userBlockModel.countDocuments({ blockerId })
    if (blockedCount >= SOCIAL_LIMITS.MAX_BLOCKED) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Da dat gioi han so nguoi bi block.')
    }

    const block = await userBlockModel.create({ blockerId, blockedId })

    // Xoa friendship neu co
    const { userA, userB } = toPairKey(blockerId, blockedId)
    await friendshipModel.deleteOne({
        userA,
        userB,
        $or: [
            { status: FRIENDSHIP_STATUS.ACCEPTED },
            { status: FRIENDSHIP_STATUS.PENDING }
        ]
    })

    return block
}

const unblockUser = async (blockerId, blockedId) => {
    const block = await userBlockModel.findOneAndDelete({ blockerId, blockedId })
    if (!block) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay ban ghi block.')
    return block
}

const USER_SELECT = '_id displayName username avatarUrl'

const listBlocked = async (blockerId, { page = 1, limit = SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT } = {}) => {
    const safeLimit = Math.min(Number(limit), SOCIAL_LIMITS.PAGE_LIMIT_MAX)
    const skip = (Number(page) - 1) * safeLimit

    const [blocks, total] = await Promise.all([
        userBlockModel
            .find({ blockerId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate('blockedId', USER_SELECT)
            .lean(),
        userBlockModel.countDocuments({ blockerId })
    ])

    const items = blocks.map((b) => ({ block: { _id: b._id, createdAt: b.createdAt }, blocked: b.blockedId }))
    return { items, total, page: Number(page), limit: safeLimit }
}

export default { blockUser, unblockUser, listBlocked }
