import { FRIENDSHIP_STATUS, RELATIONSHIP_STATE } from '../../constants/index.js'

const sameId = (left, right) => String(left) === String(right)

const resolveRelationshipState = ({ friendship, blockByMe, blockMe, meId }) => {
    if (blockByMe) return RELATIONSHIP_STATE.BLOCKED_BY_ME
    if (blockMe) return RELATIONSHIP_STATE.BLOCKED_ME
    if (!friendship) return RELATIONSHIP_STATE.NONE
    if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) return RELATIONSHIP_STATE.FRIENDS

    if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
        return sameId(friendship.requesterId, meId)
            ? RELATIONSHIP_STATE.OUTGOING_PENDING
            : RELATIONSHIP_STATE.INCOMING_PENDING
    }

    return RELATIONSHIP_STATE.NONE
}

const canSendRequest = (friendship, now = new Date(), cooldownHours = 24) => {
    if (!friendship) return { allowed: true }
    if (friendship.status !== FRIENDSHIP_STATUS.DECLINED) return { allowed: false }

    const retryAt = new Date(friendship.respondedAt)
    retryAt.setUTCHours(retryAt.getUTCHours() + cooldownHours)
    return retryAt <= now
        ? { allowed: true }
        : { allowed: false, retryAt, retryAfterSeconds: Math.ceil((retryAt - now) / 1000) }
}

export { resolveRelationshipState, canSendRequest }