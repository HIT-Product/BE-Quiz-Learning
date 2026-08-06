import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { SOCIAL_LIMITS, PRESENCE_STATUS } from '../../src/constants/index.js'
import { parseAggregate } from '../../src/utils/presence.js'

const staleMs = SOCIAL_LIMITS.PRESENCE_STALE_SECONDS * 1000
const entry = (status, seenAt) => JSON.stringify({ status, seenAt })

describe('parseAggregate', () => {
  const now = 1_700_000_000_000

  test('bỏ qua connection đã stale', () => {
    const raw = {
      socketA: entry(PRESENCE_STATUS.ONLINE, now - staleMs - 1),
      socketB: entry(PRESENCE_STATUS.IDLE, now - 1000)
    }
    assert.equal(parseAggregate(raw, now), PRESENCE_STATUS.IDLE)
  })

  test('offline khi mọi connection đều stale', () => {
    const raw = { socketA: entry(PRESENCE_STATUS.ONLINE, now - staleMs - 1) }
    assert.equal(parseAggregate(raw, now), PRESENCE_STATUS.OFFLINE)
  })

  test('online thắng idle khi cả hai còn tươi', () => {
    const raw = {
      socketA: entry(PRESENCE_STATUS.IDLE, now - 1000),
      socketB: entry(PRESENCE_STATUS.ONLINE, now - 500)
    }
    assert.equal(parseAggregate(raw, now), PRESENCE_STATUS.ONLINE)
  })

  test('bỏ qua entry không parse được', () => {
    assert.equal(parseAggregate({ socketA: 'not-json' }, now), PRESENCE_STATUS.OFFLINE)
  })
})
