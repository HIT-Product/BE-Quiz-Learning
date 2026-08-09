import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIN_SECRET_LENGTH = 32
const REQUIRED_SECRETS = ['JWT_SECRET_LOGIN', 'JWT_SECRET_REFRESH', 'OTP_PEPPER']

const ensureProductionSecrets = async (envPath = resolve(process.cwd(), '.env')) => {
  let content = await readFile(envPath, 'utf8')
  const updated = []

  for (const key of REQUIRED_SECRETS) {
    const pattern = new RegExp(`^${key}=(.*)$`, 'gm')
    const matches = [...content.matchAll(pattern)]
    const isStrong = matches.length === 1 && matches[0][1].trim().length >= MIN_SECRET_LENGTH

    if (isStrong) continue

    const replacement = `${key}=${randomBytes(32).toString('hex')}`
    if (matches.length > 0) {
      content = content.replace(pattern, replacement)
    } else {
      content = `${content.trimEnd()}\n${replacement}\n`
    }
    updated.push(key)
  }

  if (updated.length > 0) {
    await writeFile(envPath, content, { encoding: 'utf8', mode: 0o600 })
  }

  return updated
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const envPath = resolve(process.cwd(), process.argv[2] || '.env')

  try {
    const updated = await ensureProductionSecrets(envPath)
    if (updated.length === 0) {
      console.log('Production authentication secrets are already valid.')
    } else {
      console.log(`Generated strong production secrets for: ${updated.join(', ')}`)
    }
  } catch (error) {
    console.error(`Failed to set up production secrets: ${error.message}`)
    process.exitCode = 1
  }
}

export { ensureProductionSecrets, MIN_SECRET_LENGTH, REQUIRED_SECRETS }
