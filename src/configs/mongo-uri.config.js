import { ENV_DEFAULTS, NUMBER_PARSE_RADIX } from '../constants/index.js'

const buildMongoUri = (source = process.env) => {
  if (source.MONGO_URI?.trim()) return source.MONGO_URI.trim()

  const username = source.MONGO_USERNAME?.trim()
  const password = source.MONGO_PASSWORD
  if (!username || !password) return ENV_DEFAULTS.MONGO_URI

  const host = source.MONGO_HOST?.trim() || 'mongo'
  const port = parseInt(source.MONGO_PORT, NUMBER_PARSE_RADIX) || 27017
  const database = source.MONGO_DATABASE?.trim() || 'hitproduct'

  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?authSource=admin`
}

export { buildMongoUri }
