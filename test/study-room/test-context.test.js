import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertTestMongoUri,
  testRunId,
  trackedRedisKeys,
  trackRedisKey
} from './helpers/testContext.js'

test('Mongo guard accepts test databases and rejects non-test databases', () => {
  assert.doesNotThrow(() => assertTestMongoUri('mongodb://localhost:27017/hitproduct_test'))
  assert.throws(
    () => assertTestMongoUri('mongodb://localhost:27017/hitproduct'),
    /Refusing to run Study Room tests outside a test database/
  )
})

test('Redis cleanup context tracks only exact keys registered by the test', () => {
  trackedRedisKeys.clear()
  const key = `test:study-room:${testRunId}:presence:room-1`

  assert.equal(trackRedisKey(key), key)
  assert.deepEqual([...trackedRedisKeys], [key])

  trackedRedisKeys.clear()
})
