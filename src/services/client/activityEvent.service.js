import { activityEventModel } from '../../models/index.js'
import { logger } from '../../utils/index.js'

const recordActivityEvent = async (event) => {
    try {
        const document = await activityEventModel.findOneAndUpdate(
            { userId: event.userId, dedupKey: event.dedupKey },
            { $setOnInsert: event },
            { new: true, upsert: true }
        )
        logger.info(`event=activity.recorded userId=${event.userId} type=${event.type}`)
        return document
    } catch (error) {
        logger.warn(
            `event=activity.record_failed userId=${event.userId} type=${event.type} reason=${error.message}`
        )
        return null
    }
}

export { recordActivityEvent }
export default { recordActivityEvent }