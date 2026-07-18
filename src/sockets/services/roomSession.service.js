import { redisClient } from '../../configs/index.js'
import { ROOM_DEVICE_TTL_SECONDS, ROOM_REDIS_KEY, ROOM_REDIS_TTL_SECONDS } from '../../constants/index.js'
import { socketError } from '../utils/socketHandler.js'

const CLAIM_DEVICE_LUA = `
local previous = redis.call('GET', KEYS[1])
local generation = redis.call('INCR', KEYS[2])
local current = cjson.encode({
  roomId = ARGV[1],
  userId = ARGV[2],
  socketId = ARGV[3],
  sessionId = ARGV[4],
  deviceId = ARGV[5],
  generation = generation,
  claimedAt = ARGV[6]
})
redis.call('SET', KEYS[1], current, 'EX', ARGV[7])
redis.call('EXPIRE', KEYS[2], ARGV[7])
return { previous or '', current, tostring(generation) }
`

const RELEASE_DEVICE_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if tostring(decoded.generation) ~= tostring(ARGV[1]) then return 0 end
if tostring(decoded.socketId) ~= tostring(ARGV[2]) then return 0 end
redis.call('DEL', KEYS[1])
return 1
`

const JOIN_PRESENCE_LUA = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current and redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[4]) then
  return -1
end
local value = cjson.encode({ socketId = ARGV[2], generation = ARGV[3] })
redis.call('HSET', KEYS[1], ARGV[1], value)
redis.call('EXPIRE', KEYS[1], ARGV[5])
if current then return 1 end
return 2
`

const REMOVE_PRESENCE_LUA = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return redis.call('HLEN', KEYS[1]) end
local decoded = cjson.decode(current)
if tostring(decoded.generation) == tostring(ARGV[2])
  and tostring(decoded.socketId) == tostring(ARGV[3]) then
  redis.call('HDEL', KEYS[1], ARGV[1])
end
return redis.call('HLEN', KEYS[1])
`

const parseJson = (value) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const claimDevice = async ({ roomId, userId, socketId, sessionId, deviceId }) => {
  const result = await redisClient.eval(
    CLAIM_DEVICE_LUA,
    2,
    ROOM_REDIS_KEY.ACTIVE_DEVICE(userId),
    ROOM_REDIS_KEY.DEVICE_GENERATION(userId),
    String(roomId),
    String(userId),
    String(socketId),
    String(sessionId),
    String(deviceId),
    String(Date.now()),
    String(ROOM_DEVICE_TTL_SECONDS)
  )

  return {
    previous: parseJson(result?.[0]),
    current: parseJson(result?.[1]),
    generation: Number(result?.[2])
  }
}

const getActiveDevice = async (userId) => {
  return parseJson(await redisClient.get(ROOM_REDIS_KEY.ACTIVE_DEVICE(userId)))
}

const isDeviceOwner = async ({ userId, roomId, socketId, generation, deviceId }) => {
  const active = await getActiveDevice(userId)
  if (!active) return false
  return (
    String(active.roomId) === String(roomId) &&
    String(active.socketId) === String(socketId) &&
    Number(active.generation) === Number(generation) &&
    (!deviceId || String(active.deviceId) === String(deviceId))
  )
}

const assertDeviceOwner = async (input) => {
  if (!(await isDeviceOwner(input))) {
    throw socketError('SESSION_TAKEN_OVER', 'Phien phong hoc da chuyen sang thiet bi khac.')
  }
}

const releaseDevice = async ({ userId, socketId, generation }) => {
  const released = await redisClient.eval(
    RELEASE_DEVICE_LUA,
    1,
    ROOM_REDIS_KEY.ACTIVE_DEVICE(userId),
    String(generation),
    String(socketId)
  )
  return Number(released) === 1
}

const joinPresence = async ({ roomId, userId, socketId, generation, maxParticipants }) => {
  const result = await redisClient.eval(
    JOIN_PRESENCE_LUA,
    1,
    ROOM_REDIS_KEY.PRESENCE(roomId),
    String(userId),
    String(socketId),
    String(generation),
    String(maxParticipants),
    String(ROOM_REDIS_TTL_SECONDS)
  )
  if (Number(result) === -1) throw socketError('ROOM_FULL', 'Phong da day.')
  return { isNewMember: Number(result) === 2 }
}

const removePresence = async ({ roomId, userId, socketId, generation }) => {
  return Number(
    await redisClient.eval(
      REMOVE_PRESENCE_LUA,
      1,
      ROOM_REDIS_KEY.PRESENCE(roomId),
      String(userId),
      String(generation),
      String(socketId)
    )
  )
}

const refreshPresence = async ({ roomId, userId, socketId, generation }) => {
  const key = ROOM_REDIS_KEY.PRESENCE(roomId)
  await redisClient.hset(
    key,
    String(userId),
    JSON.stringify({ socketId: String(socketId), generation: String(generation) })
  )
  await redisClient.expire(key, ROOM_REDIS_TTL_SECONDS)
}

const forceRemovePresence = async (roomId, userId) => {
  return redisClient.hdel(ROOM_REDIS_KEY.PRESENCE(roomId), String(userId))
}

const listPresenceUserIds = async (roomId) => {
  return redisClient.hkeys(ROOM_REDIS_KEY.PRESENCE(roomId))
}

const countPresence = async (roomId) => {
  return redisClient.hlen(ROOM_REDIS_KEY.PRESENCE(roomId))
}

export default {
  claimDevice,
  getActiveDevice,
  isDeviceOwner,
  assertDeviceOwner,
  releaseDevice,
  joinPresence,
  removePresence,
  refreshPresence,
  forceRemovePresence,
  listPresenceUserIds,
  countPresence
}
