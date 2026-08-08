import { StatusCodes } from 'http-status-codes'

import {
    FRIENDSHIP_STATUS,
    FRIEND_REQUEST_POLICY,
    NOTIFICATION_TYPE,
    SOCIAL_LIMITS
} from '../../constants/index.js'
import { friendshipModel, userBlockModel, userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { toPairKey } from '../../utils/pairKey.js'
import { canSendRequest } from './friendRelationship.service.js'
import { createNotification } from './notification.service.js'
import { getPresenceMap } from './presence.service.js'

const hasBlockBetween = async (userId, targetId) =>
    Boolean(
        await userBlockModel.exists({
            $or: [
                { blockerId: userId, blockedId: targetId },
                { blockerId: targetId, blockedId: userId }
            ]
        })
    )

const assertTargetCanReceiveRequest = async (userId, targetId) => {
    if (String(userId) === String(targetId)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Khong the gui loi moi cho chinh minh.')
    }

    const target = await userModel
        .findById(targetId)
        .select('_id friendRequestPolicy')
        .lean()
    if (!target || (await hasBlockBetween(userId, targetId))) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay nguoi dung.')
    }
    if (target.friendRequestPolicy === FRIEND_REQUEST_POLICY.NOBODY) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Nguoi dung hien khong nhan loi moi ket ban.')
    }
}

const SEND_REQUEST_MAX_ATTEMPTS = 3

const sendRequest = async (requesterId, addresseeId) => {
    await assertTargetCanReceiveRequest(requesterId, addresseeId)

    const friendCount = await friendshipModel.countDocuments({
        $or: [{ userA: requesterId }, { userB: requesterId }],
        status: FRIENDSHIP_STATUS.ACCEPTED
    })
    if (friendCount >= SOCIAL_LIMITS.MAX_FRIENDS) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Ban da dat gioi han so luong ban be.')
    }

    const pendingOutCount = await friendshipModel.countDocuments({
        requesterId,
        status: FRIENDSHIP_STATUS.PENDING
    })
    if (pendingOutCount >= SOCIAL_LIMITS.MAX_PENDING_OUTGOING) {
        throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Ban da dat gioi han loi moi dang cho.')
    }

    const { userA, userB } = toPairKey(requesterId, addresseeId)

    for (let attempt = 0; attempt < SEND_REQUEST_MAX_ATTEMPTS; attempt += 1) {
        const now = new Date()
        const existing = await friendshipModel.findOne({ userA, userB })

        if (existing?.status === FRIENDSHIP_STATUS.ACCEPTED) {
            throw new ApiError(StatusCodes.CONFLICT, 'Hai nguoi da la ban be.')
        }

        if (existing?.status === FRIENDSHIP_STATUS.PENDING) {
            if (String(existing.requesterId) === String(requesterId)) {
                throw new ApiError(StatusCodes.CONFLICT, 'Loi moi da duoc gui truoc do.')
            }

            const accepted = await friendshipModel.findOneAndUpdate(
                {
                    _id: existing._id,
                    status: FRIENDSHIP_STATUS.PENDING,
                    requesterId: addresseeId,
                    addresseeId: requesterId
                },
                {
                    $set: {
                        status: FRIENDSHIP_STATUS.ACCEPTED,
                        respondedAt: now
                    }
                },
                { new: true }
            )
            if (accepted) {
                void createNotification({
                    userId: addresseeId,
                    actorId: requesterId,
                    type: NOTIFICATION_TYPE.FRIEND_REQUEST_ACCEPTED,
                    entityType: 'Friendship',
                    entityId: accepted._id,
                    dedupKey: `friend_request_accepted:${accepted._id}`
                })
                return { friendship: accepted, autoAccepted: true }
            }
            continue
        }

        if (existing?.status === FRIENDSHIP_STATUS.DECLINED) {
            const retry = canSendRequest(existing, now, SOCIAL_LIMITS.REQUEST_RESEND_COOLDOWN_HOURS)
            if (!retry.allowed) {
                const error = new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Hay cho truoc khi gui lai loi moi.')
                error.retryAfterSeconds = retry.retryAfterSeconds
                throw error
            }

            const reopened = await friendshipModel.findOneAndUpdate(
                { _id: existing._id, status: FRIENDSHIP_STATUS.DECLINED },
                {
                    $set: {
                        requesterId,
                        addresseeId,
                        status: FRIENDSHIP_STATUS.PENDING,
                        requestedAt: now,
                        respondedAt: null
                    }
                },
                { new: true }
            )
            if (reopened) return { friendship: reopened, autoAccepted: false }
            continue
        }

        try {
            const friendship = await friendshipModel.create({
                userA,
                userB,
                requesterId,
                addresseeId,
                status: FRIENDSHIP_STATUS.PENDING,
                requestedAt: now
            })
            void createNotification({
                userId: addresseeId,
                actorId: requesterId,
                type: NOTIFICATION_TYPE.FRIEND_REQUEST_RECEIVED,
                entityType: 'Friendship',
                entityId: friendship._id,
                dedupKey: `friend_request_received:${friendship._id}`
            })
            return { friendship, autoAccepted: false }
        } catch (error) {
            if (error?.code !== 11000) throw error
        }
    }

    throw new ApiError(StatusCodes.CONFLICT, 'Khong the xu ly loi moi do xung dot, hay thu lai.')
}

const acceptRequest = async (requestId, addresseeId) => {
    const friendship = await friendshipModel.findOneAndUpdate(
        {
            _id: requestId,
            addresseeId,
            status: FRIENDSHIP_STATUS.PENDING
        },
        {
            $set: {
                status: FRIENDSHIP_STATUS.ACCEPTED,
                respondedAt: new Date()
            }
        },
        { new: true }
    )

    if (friendship) {
        void createNotification({
            userId: String(friendship.requesterId),
            actorId: String(addresseeId),
            type: NOTIFICATION_TYPE.FRIEND_REQUEST_ACCEPTED,
            entityType: 'Friendship',
            entityId: friendship._id,
            dedupKey: `friend_request_accepted:${friendship._id}`
        })
        return friendship
    }

    const owned = await friendshipModel.findOne({ _id: requestId, addresseeId }).select('status').lean()
    if (!owned) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay loi moi.')
    throw new ApiError(StatusCodes.CONFLICT, 'Loi moi khong con o trang thai cho.')
}

const declineRequest = async (requestId, addresseeId) => {
    const friendship = await friendshipModel.findOneAndUpdate(
        {
            _id: requestId,
            addresseeId,
            status: FRIENDSHIP_STATUS.PENDING
        },
        {
            $set: {
                status: FRIENDSHIP_STATUS.DECLINED,
                respondedAt: new Date()
            }
        },
        { new: true }
    )

    if (friendship) return friendship

    const owned = await friendshipModel.findOne({ _id: requestId, addresseeId }).select('status').lean()
    if (!owned) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay loi moi.')
    throw new ApiError(StatusCodes.CONFLICT, 'Loi moi khong con o trang thai cho.')
}

const cancelRequest = async (requestId, requesterId) => {
    const friendship = await friendshipModel.findOneAndDelete({
        _id: requestId,
        requesterId,
        status: FRIENDSHIP_STATUS.PENDING
    })

    if (friendship) return friendship

    const owned = await friendshipModel.findOne({ _id: requestId, requesterId }).select('status').lean()
    if (!owned) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay loi moi.')
    throw new ApiError(StatusCodes.CONFLICT, 'Loi moi khong con o trang thai cho.')
}

const unfriend = async (userId, friendshipId) => {
    const friendship = await friendshipModel.findOneAndDelete({
        _id: friendshipId,
        status: FRIENDSHIP_STATUS.ACCEPTED,
        $or: [{ userA: userId }, { userB: userId }]
    })

    if (friendship) return friendship

    const exists = await friendshipModel
        .findOne({ _id: friendshipId, $or: [{ userA: userId }, { userB: userId }] })
        .select('status')
        .lean()
    if (!exists) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay quan he ban be.')
    throw new ApiError(StatusCodes.CONFLICT, 'Quan he ban be khong o trang thai hop le.')
}

const USER_SELECT = '_id displayName username avatarUrl'

const listFriends = async (userId, { page = 1, limit = SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT } = {}) => {
    const safeLimit = Math.min(Number(limit), SOCIAL_LIMITS.PAGE_LIMIT_MAX)
    const skip = (Number(page) - 1) * safeLimit

    const [friendships, total] = await Promise.all([
        friendshipModel
            .find({
                $or: [{ userA: userId }, { userB: userId }],
                status: FRIENDSHIP_STATUS.ACCEPTED
            })
            .sort({ respondedAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate('userA', USER_SELECT)
            .populate('userB', USER_SELECT)
            .lean(),
        friendshipModel.countDocuments({
            $or: [{ userA: userId }, { userB: userId }],
            status: FRIENDSHIP_STATUS.ACCEPTED
        })
    ])

    const items = friendships.map((f) => {
        const friend = String(f.userA._id) === String(userId) ? f.userB : f.userA
        return { friendship: { _id: f._id, respondedAt: f.respondedAt }, friend }
    })

    return { items, total, page: Number(page), limit: safeLimit }
}

const listPendingRequests = async (userId, { page = 1, limit = SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT } = {}) => {
    const safeLimit = Math.min(Number(limit), SOCIAL_LIMITS.PAGE_LIMIT_MAX)
    const skip = (Number(page) - 1) * safeLimit

    const [friendships, total] = await Promise.all([
        friendshipModel
            .find({ addresseeId: userId, status: FRIENDSHIP_STATUS.PENDING })
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate('requesterId', USER_SELECT)
            .lean(),
        friendshipModel.countDocuments({ addresseeId: userId, status: FRIENDSHIP_STATUS.PENDING })
    ])

    const items = friendships.map((f) => ({
        friendship: { _id: f._id, requestedAt: f.requestedAt },
        requester: f.requesterId
    }))

    return { items, total, page: Number(page), limit: safeLimit }
}

const getFriendsPresence = async (userId) => {
    const friendships = await friendshipModel
        .find({
            $or: [{ userA: userId }, { userB: userId }],
            status: FRIENDSHIP_STATUS.ACCEPTED
        })
        .select('userA userB')
        .lean()
        .limit(SOCIAL_LIMITS.PRESENCE_FANOUT_MAX_FRIENDS)

    const friendIds = friendships.map((f) =>
        String(f.userA) === String(userId) ? String(f.userB) : String(f.userA)
    )

    const presenceMap = await getPresenceMap(friendIds)
    const result = {}
    for (const [id, status] of presenceMap) result[id] = status
    return result
}

export default {
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
    listFriends,
    listPendingRequests,
    getFriendsPresence
}
