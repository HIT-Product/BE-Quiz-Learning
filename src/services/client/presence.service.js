import { redisClient } from '../../configs/index.js'
import { PRESENCE_STATUS, SOCIAL_LIMITS, SOCIAL_REDIS_KEY } from '../../constants/index.js'
import { logger } from '../../utils/index.js'
import { parseAggregate } from '../../utils/presence.js'

const setConnection = async (userId, socketId, status = PRESENCE_STATUS.ONLINE) => {
    const key = SOCIAL_REDIS_KEY.PRESENCE(userId)
    const pipeline = redisClient.pipeline()
    pipeline.hset(key, socketId, JSON.stringify({ status, seenAt: Date.now() }))
    pipeline.expire(key, SOCIAL_LIMITS.PRESENCE_STALE_SECONDS)
    await pipeline.exec()
}

const heartbeat = (userId, socketId, status) => setConnection(userId, socketId, status)

const clearConnection = async (userId, socketId) => {
    const key = SOCIAL_REDIS_KEY.PRESENCE(userId)
    await redisClient.hdel(key, socketId)
    const remaining = await redisClient.hlen(key)
    if (remaining > 0) await redisClient.expire(key, SOCIAL_LIMITS.PRESENCE_STALE_SECONDS)
}

const getPresenceMap = async (userIds) => {
    const ids = [...new Set(userIds.map(String))]
    const fallback = new Map(ids.map((id) => [id, PRESENCE_STATUS.OFFLINE]))
    if (ids.length === 0) return fallback

    try {
        const pipeline = redisClient.pipeline()
        for (const id of ids) pipeline.hgetall(SOCIAL_REDIS_KEY.PRESENCE(id))
        const results = await pipeline.exec()
        const now = Date.now()

        return new Map(
            ids.map((id, index) => {
                const [error, raw] = results[index]
                return [id, error ? PRESENCE_STATUS.OFFLINE : parseAggregate(raw || {}, now)]
            })
        )
    } catch (error) {
        logger.warn(`Presence unavailable: ${error.message}`)
        return fallback
    }
}

const countOnline = async (userIds) => {
    const map = await getPresenceMap(userIds)
    return [...map.values()].filter((status) => status !== PRESENCE_STATUS.OFFLINE).length
}

export { setConnection, heartbeat, clearConnection, getPresenceMap, countOnline }
export default { setConnection, heartbeat, clearConnection, getPresenceMap, countOnline }