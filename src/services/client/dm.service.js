import { StatusCodes } from 'http-status-codes'

import { FRIENDSHIP_STATUS, NOTIFICATION_TYPE, SOCIAL_LIMITS } from '../../constants/index.js'
import {
    conversationMemberModel,
    conversationModel,
    directMessageModel,
    friendshipModel,
    userBlockModel
} from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { toPairKey } from '../../utils/pairKey.js'
import { createNotification } from './notification.service.js'

const assertCanMessage = async (senderId, recipientId) => {
    const { userA, userB } = toPairKey(senderId, recipientId)

    const friendship = await friendshipModel
        .findOne({ userA, userB, status: FRIENDSHIP_STATUS.ACCEPTED })
        .select('_id')
        .lean()
    if (!friendship) throw new ApiError(StatusCodes.FORBIDDEN, 'Chi co the nhan tin voi ban be.')

    const blocked = await userBlockModel.exists({
        $or: [
            { blockerId: senderId, blockedId: recipientId },
            { blockerId: recipientId, blockedId: senderId }
        ]
    })
    if (blocked) throw new ApiError(StatusCodes.FORBIDDEN, 'Khong the nhan tin voi nguoi nay.')
}

const getOrCreateConversation = async (userIdA, userIdB) => {
    const { userA, userB } = toPairKey(userIdA, userIdB)

    let conversation = await conversationModel.findOne({ userA, userB }).lean()
    if (conversation) return conversation

    try {
        conversation = await conversationModel.create({ userA, userB })

        await conversationMemberModel.insertMany([
            { conversationId: conversation._id, userId: userA },
            { conversationId: conversation._id, userId: userB }
        ])

        return conversation
    } catch (error) {
        if (error?.code === 11000) {
            return conversationModel.findOne({ userA, userB }).lean()
        }
        throw error
    }
}

const sendMessage = async (senderId, recipientId, { body, clientMessageId }) => {
    await assertCanMessage(senderId, recipientId)

    const conversation = await getOrCreateConversation(senderId, recipientId)

    let message
    let deduped = false

    try {
        message = await directMessageModel.create({
            conversationId: conversation._id,
            senderId,
            clientMessageId,
            body
        })
    } catch (error) {
        if (error?.code !== 11000) throw error
        message = await directMessageModel
            .findOne({ conversationId: conversation._id, senderId, clientMessageId })
            .lean()
        deduped = true
    }

    if (!deduped) {
        const preview = body.length > SOCIAL_LIMITS.DM_PREVIEW_MAX ? body.slice(0, SOCIAL_LIMITS.DM_PREVIEW_MAX) : body

        await Promise.all([
            conversationModel.findByIdAndUpdate(conversation._id, {
                $set: { lastMessageAt: message.createdAt, lastMessagePreview: preview }
            }),
            conversationMemberModel.findOneAndUpdate(
                { conversationId: conversation._id, userId: recipientId },
                { $inc: { unreadCount: 1 } }
            )
        ])

        void createNotification({
            userId: String(recipientId),
            actorId: String(senderId),
            type: NOTIFICATION_TYPE.DIRECT_MESSAGE,
            entityType: 'DirectMessage',
            entityId: message._id,
            dedupKey: `dm:${message._id}`
        })
    }

    return { message, deduped }
}

const listConversations = async (userId, { page = 1, limit = SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT } = {}) => {
    const safeLimit = Math.min(Number(limit), SOCIAL_LIMITS.PAGE_LIMIT_MAX)
    const skip = (Number(page) - 1) * safeLimit

    const USER_SELECT = '_id displayName username avatarUrl'

    const [conversations, total] = await Promise.all([
        conversationModel
            .find({ $or: [{ userA: userId }, { userB: userId }], lastMessageAt: { $ne: null } })
            .sort({ lastMessageAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate('userA', USER_SELECT)
            .populate('userB', USER_SELECT)
            .lean(),
        conversationModel.countDocuments({ $or: [{ userA: userId }, { userB: userId }], lastMessageAt: { $ne: null } })
    ])

    const convIds = conversations.map((c) => c._id)
    const members = await conversationMemberModel
        .find({ conversationId: { $in: convIds }, userId })
        .select('conversationId unreadCount')
        .lean()
    const unreadMap = new Map(members.map((m) => [String(m.conversationId), m.unreadCount]))

    const items = conversations.map((c) => {
        const partner = String(c.userA._id) === String(userId) ? c.userB : c.userA
        return {
            conversation: {
                _id: c._id,
                lastMessageAt: c.lastMessageAt,
                lastMessagePreview: c.lastMessagePreview,
                unreadCount: unreadMap.get(String(c._id)) ?? 0
            },
            partner
        }
    })

    return { items, total, page: Number(page), limit: safeLimit }
}

const listMessages = async (userId, conversationId, { before, limit = 30 } = {}) => {
    const safeLimit = Math.min(Number(limit), 50)

    const member = await conversationMemberModel
        .findOne({ conversationId, userId })
        .select('_id')
        .lean()
    if (!member) throw new ApiError(StatusCodes.FORBIDDEN, 'Ban khong phai thanh vien cua cuoc tro chuyen nay.')

    const query = { conversationId }
    if (before) query._id = { $lt: before }

    const messages = await directMessageModel
        .find(query)
        .sort({ _id: -1 })
        .limit(safeLimit)
        .lean()

    return { items: messages.reverse(), hasMore: messages.length === safeLimit }
}

const markRead = async (userId, conversationId) => {
    const lastMessage = await directMessageModel
        .findOne({ conversationId })
        .sort({ _id: -1 })
        .select('_id')
        .lean()

    await conversationMemberModel.findOneAndUpdate(
        { conversationId, userId },
        {
            $set: {
                unreadCount: 0,
                lastReadMessageId: lastMessage?._id ?? null,
                lastReadAt: new Date()
            }
        }
    )
}

export default { sendMessage, listConversations, listMessages, markRead, getOrCreateConversation }
