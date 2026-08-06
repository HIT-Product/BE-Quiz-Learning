import { ACTIVITY_VISIBILITY, FRIENDSHIP_STATUS, SOCIAL_LIMITS } from '../../constants/index.js'
import { activityEventModel, friendshipModel, userBlockModel } from '../../models/index.js'

const getFeed = async (userId, { page = 1, limit = SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT } = {}) => {
    const safeLimit = Math.min(Number(limit), SOCIAL_LIMITS.PAGE_LIMIT_MAX)
    const skip = (Number(page) - 1) * safeLimit

    const [friendships, blocks] = await Promise.all([
        friendshipModel
            .find({
                $or: [{ userA: userId }, { userB: userId }],
                status: FRIENDSHIP_STATUS.ACCEPTED
            })
            .select('userA userB')
            .lean()
            .limit(SOCIAL_LIMITS.ACTIVITY_FEED_MAX_FRIENDS),
        userBlockModel
            .find({ $or: [{ blockerId: userId }, { blockedId: userId }] })
            .select('blockerId blockedId')
            .lean()
    ])

    const blockedIds = new Set(
        blocks.flatMap((b) => [String(b.blockerId), String(b.blockedId)]).filter((id) => id !== String(userId))
    )

    const friendIds = friendships
        .map((f) => (String(f.userA) === String(userId) ? String(f.userB) : String(f.userA)))
        .filter((id) => !blockedIds.has(id))

    if (friendIds.length === 0) return { items: [], total: 0, page: Number(page), limit: safeLimit }

    const [events, total] = await Promise.all([
        activityEventModel
            .find({
                userId: { $in: friendIds },
                visibility: ACTIVITY_VISIBILITY.FRIENDS
            })
            .sort({ occurredAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate('userId', '_id displayName username avatarUrl')
            .lean(),
        activityEventModel.countDocuments({
            userId: { $in: friendIds },
            visibility: ACTIVITY_VISIBILITY.FRIENDS
        })
    ])

    return { items: events, total, page: Number(page), limit: safeLimit }
}

export default { getFeed }
