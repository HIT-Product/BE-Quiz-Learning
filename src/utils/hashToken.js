import crypto from 'crypto'
import { envConfig } from '../configs/index.js'

const hashToken = (token) => {
  const pepper = envConfig.otp?.pepper || 'fallback-pepper-change-me'
  return crypto.createHash('sha256').update(token + pepper).digest('hex')
}

export default hashToken
