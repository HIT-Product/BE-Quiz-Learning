import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { buildMongoUri } from '../../src/configs/mongo-uri.config.js'

test('buildMongoUri builds a Docker Compose MongoDB URI', () => {
  assert.equal(
    buildMongoUri({
      MONGO_HOST: 'mongo',
      MONGO_PORT: '27017',
      MONGO_DATABASE: 'hit product',
      MONGO_USERNAME: 'admin@example.com',
      MONGO_PASSWORD: 'p@ss/word'
    }),
    'mongodb://admin%40example.com:p%40ss%2Fword@mongo:27017/hit%20product?authSource=admin'
  )
})

test('promote-admin validates its argument without requiring unrelated production secrets', () => {
  const result = spawnSync(process.execPath, ['scripts/promote-admin.js', 'invalid-email'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' }
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Usage: npm run admin:promote/)
  assert.doesNotMatch(result.stderr, /Missing production environment variables/)
})
