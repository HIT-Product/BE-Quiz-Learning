import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { validateProductionEnv } from '../../src/configs/env.config.js'

const validProductionEnv = {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb://database/app',
  REDIS_URL: 'redis://cache:6379',
  JWT_SECRET_LOGIN: 'l'.repeat(32),
  JWT_SECRET_REFRESH: 'r'.repeat(32),
  JWT_EXPIRESIN_LOGIN: '15m',
  JWT_EXPIRESIN_REFRESH: '7d',
  OTP_PEPPER: 'p'.repeat(32),
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'https://api.example.com/api/v1/auth/google-callback',
  EMAIL_SMTP_USER: 'mailer@example.com',
  EMAIL_SMTP_PASS: 'password'
}

describe('production environment validation', () => {
  test('does not require production secrets in development', () => {
    assert.doesNotThrow(() => validateProductionEnv({ NODE_ENV: 'development' }))
  })

  test('accepts managed Mongo and Redis URLs', () => {
    assert.doesNotThrow(() => validateProductionEnv(validProductionEnv))
  })

  test('reports missing production configuration before startup', () => {
    assert.throws(
      () => validateProductionEnv({ NODE_ENV: 'production' }),
      /JWT_SECRET_LOGIN.*MONGO_URI.*REDIS_URL/
    )
  })

  test('rejects weak authentication secrets', () => {
    assert.throws(
      () => validateProductionEnv({ ...validProductionEnv, JWT_SECRET_LOGIN: 'short' }),
      /JWT_SECRET_LOGIN must contain at least 32 characters/
    )
  })
})
