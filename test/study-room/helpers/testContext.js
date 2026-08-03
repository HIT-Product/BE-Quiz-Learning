import { randomUUID } from 'node:crypto'

const testRunId = randomUUID()
const trackedRedisKeys = new Set()

const assertTestMongoUri = (uri) => {
  const databaseName = new URL(uri).pathname.replace(/^\//, '')
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error('Refusing to run Study Room tests outside a test database.')
  }
}

const trackRedisKey = (key) => {
  trackedRedisKeys.add(key)
  return key
}

export { assertTestMongoUri, testRunId, trackedRedisKeys, trackRedisKey }