import { notificationModel } from '../../models/index.js'
import { logger } from '../../utils/index.js'

const createNotification = async ({ userId, actorId, type, entityType = null, entityId = null, dedupKey, data = {} }) => {
    try {
        const notification = await notificationModel.findOneAndUpdate(
            { userId, dedupKey },
            {
                $setOnInsert: {
                    userId,
                    actorId,
                    type,
                    entityType,
                    entityId,
                    dedupKey,
                    data,
                    readAt: null
                }
            },
            { new: true, upsert: true }
        )
        return notification
    } catch (error) {
        logger.warn(`event=notification.create_failed userId=${userId} type=${type} reason=${error.message}`)
        return null
    }
}

export { createNotification }
export default { createNotification }
