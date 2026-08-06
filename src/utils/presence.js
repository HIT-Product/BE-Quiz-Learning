import { PRESENCE_STATUS, SOCIAL_LIMITS } from '../constants/index.js'

const aggregateStatus = (statuses) => {
  if (statuses.includes(PRESENCE_STATUS.ONLINE)) return PRESENCE_STATUS.ONLINE
  if (statuses.includes(PRESENCE_STATUS.IDLE)) return PRESENCE_STATUS.IDLE
  return PRESENCE_STATUS.OFFLINE
}

const parseAggregate = (raw, now) => {
  const staleBefore = now - SOCIAL_LIMITS.PRESENCE_STALE_SECONDS * 1000
  const statuses = Object.values(raw).flatMap((value) => {
    try {
      const { status, seenAt } = JSON.parse(value)
      return Number(seenAt) >= staleBefore ? [status] : []
    } catch {
      return []
    }
  })
  return aggregateStatus(statuses)
}

export { aggregateStatus, parseAggregate }
