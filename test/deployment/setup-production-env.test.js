import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  ensureProductionSecrets,
  MIN_SECRET_LENGTH,
  REQUIRED_SECRETS
} from '../../scripts/setup-production-env.js'

test('generates only missing or weak production secrets', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'hitproduct-env-'))
  const envPath = join(directory, '.env')
  const existingPepper = 'p'.repeat(MIN_SECRET_LENGTH)

  await writeFile(
    envPath,
    `PORT=3000\nJWT_SECRET_LOGIN=short\nOTP_PEPPER=${existingPepper}\n`,
    'utf8'
  )

  const updated = await ensureProductionSecrets(envPath)
  const content = await readFile(envPath, 'utf8')

  assert.deepEqual(updated, ['JWT_SECRET_LOGIN', 'JWT_SECRET_REFRESH'])
  assert.match(content, /^PORT=3000$/m)
  assert.match(content, new RegExp(`^OTP_PEPPER=${existingPepper}$`, 'm'))

  for (const key of REQUIRED_SECRETS) {
    const value = content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]
    assert.ok(value?.length >= MIN_SECRET_LENGTH)
  }

  assert.deepEqual(await ensureProductionSecrets(envPath), [])
})
