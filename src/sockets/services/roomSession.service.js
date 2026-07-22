import { redisClient } from '../../configs/index.js'
import {
  ROOM_DEVICE_TTL_SECONDS,
  ROOM_REDIS_KEY,
  ROOM_REDIS_TTL_SECONDS,
  ROOM_LIMITS,
  ROOM_SESSION_TTL_SECONDS
} from '../../constants/index.js'
import { socketError } from '../utils/socketHandler.js'

const CLAIM_JOIN_LUA = `
local presenceKey = KEYS[1]
local activeKey = KEYS[2]
local generationKey = KEYS[3]

local roomId = ARGV[1]
local userId = ARGV[2]
local socketId = ARGV[3]
local sessionId = ARGV[4]
local deviceId = ARGV[5]
local nowMs = tonumber(ARGV[6])
local maxParticipants = tonumber(ARGV[7])
local ttlSeconds = tonumber(ARGV[8])
local switchConfirmed = ARGV[9] == '1'
local expectedGeneration = tonumber(ARGV[10])
local staleBeforeMs = tonumber(ARGV[11])

local activeRaw = redis.call('GET', activeKey)
local active = activeRaw and cjson.decode(activeRaw) or nil

if active then
  if tostring(active.roomId) ~= tostring(roomId) then
    return { 'ACTIVE_OTHER_ROOM', activeRaw }
  end
  if tostring(active.deviceId) ~= tostring(deviceId) and not switchConfirmed then
    return { 'SWITCH_REQUIRED', activeRaw }
  end
  if switchConfirmed and tonumber(active.generation) ~= expectedGeneration then
    return { 'STALE_SWITCH', activeRaw }
  end
end

local pairs = redis.call('HGETALL', presenceKey)
for index = 1, #pairs, 2 do
  local entry = cjson.decode(pairs[index + 1])
  if tonumber(entry.lastSeen or 0) < staleBeforeMs then
    redis.call('HDEL', presenceKey, pairs[index])
  end
end

local previousPresenceRaw = redis.call('HGET', presenceKey, userId)
if not previousPresenceRaw and redis.call('HLEN', presenceKey) >= maxParticipants then
  return { 'ROOM_FULL' }
end

if active
  and tostring(active.socketId) == tostring(socketId)
  and tostring(active.deviceId) == tostring(deviceId) then
  active.lastSeen = nowMs
  local refreshed = cjson.encode(active)
  redis.call('SET', activeKey, refreshed, 'EX', ttlSeconds)
  redis.call('HSET', presenceKey, userId, refreshed)
  redis.call('EXPIRE', presenceKey, ttlSeconds)
  return { 'OK', tostring(active.generation), activeRaw, previousPresenceRaw or '', 'RETRY' }
end

local generation = redis.call('INCR', generationKey)
local current = cjson.encode({
  roomId = roomId,
  userId = userId,
  socketId = socketId,
  sessionId = sessionId,
  deviceId = deviceId,
  generation = generation,
  lastSeen = nowMs
})
redis.call('SET', activeKey, current, 'EX', ttlSeconds)
redis.call('HSET', presenceKey, userId, current)
redis.call('EXPIRE', presenceKey, ttlSeconds)
return { 'OK', tostring(generation), activeRaw or '', previousPresenceRaw or '', 'CLAIMED' }
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

const ROLLBACK_CLAIM_LUA = `
local currentRaw = redis.call('GET', KEYS[1])
if not currentRaw then return 0 end
local current = cjson.decode(currentRaw)
if tonumber(current.generation) ~= tonumber(ARGV[2])
  or tostring(current.socketId) ~= tostring(ARGV[3]) then
  return 0
end
if ARGV[4] ~= '' then
  redis.call('SET', KEYS[1], ARGV[4], 'EX', ARGV[6])
else
  redis.call('DEL', KEYS[1])
end
if ARGV[5] ~= '' then
  redis.call('HSET', KEYS[2], ARGV[1], ARGV[5])
  redis.call('EXPIRE', KEYS[2], ARGV[6])
else
  redis.call('HDEL', KEYS[2], ARGV[1])
end
return 1
`

const HEARTBEAT_LUA = `
local activeRaw = redis.call('GET', KEYS[1])
if not activeRaw then return 0 end
local active = cjson.decode(activeRaw)
if tostring(active.roomId) ~= ARGV[1]
  or tostring(active.socketId) ~= ARGV[2]
  or tostring(active.deviceId) ~= ARGV[3]
  or tonumber(active.generation) ~= tonumber(ARGV[4]) then
  return 0
end
active.lastSeen = tonumber(ARGV[5])
local refreshed = cjson.encode(active)
redis.call('SET', KEYS[1], refreshed, 'EX', ARGV[6])
redis.call('HSET', KEYS[2], ARGV[7], refreshed)
redis.call('EXPIRE', KEYS[2], ARGV[6])
return 1
`

const RELEASE_CURRENT_LUA = `
local activeRaw = redis.call('GET', KEYS[1])
local presenceRaw = redis.call('HGET', KEYS[2], ARGV[4])

if activeRaw then
  local active = cjson.decode(activeRaw)
  if tostring(active.roomId) ~= ARGV[1]
    or tostring(active.socketId) ~= ARGV[2]
    or tonumber(active.generation) ~= tonumber(ARGV[3]) then
    return -1
  end
end
if presenceRaw then
  local presence = cjson.decode(presenceRaw)
  if tostring(presence.socketId) ~= ARGV[2]
    or tonumber(presence.generation) ~= tonumber(ARGV[3]) then
    return -1
  end
end

if activeRaw then redis.call('DEL', KEYS[1]) end
if presenceRaw then redis.call('HDEL', KEYS[2], ARGV[4]) end
return redis.call('HLEN', KEYS[2])
`

const claimJoin = async ({ roomId, userId, socketId, sessionId, deviceId, maxParticipants, switchContext }) => {
  const now = Date.now()
  const result = await redisClient.eval(
    CLAIM_JOIN_LUA,
    3,
    ROOM_REDIS_KEY.PRESENCE(roomId),
    ROOM_REDIS_KEY.ACTIVE_DEVICE(userId),
    ROOM_REDIS_KEY.DEVICE_GENERATION(userId),
    String(roomId),
    String(userId),
    String(socketId),
    String(sessionId),
    String(deviceId),
    String(now),
    String(maxParticipants),
    String(ROOM_SESSION_TTL_SECONDS),
    switchContext ? '1' : '0',
    String(switchContext?.expectedGeneration || 0),
    String(now - ROOM_LIMITS.PRESENCE_STALE_SECONDS * 1000)
  )

  const status = String(result?.[0] || 'INTERNAL_ERROR')
  if (status !== 'OK') {
    return { status, active: parseJson(result?.[1]) }
  }
  return {
    status,
    generation: Number(result[1]),
    previousActiveRaw: result[2] || '',
    previousPresenceRaw: result[3] || '',
    previousActive: parseJson(result[2]),
    kind: result[4]
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

const rollbackClaim = async ({ roomId, userId, socketId, generation, previousActiveRaw, previousPresenceRaw }) =>
  Number(
    await redisClient.eval(
      ROLLBACK_CLAIM_LUA,
      2,
      ROOM_REDIS_KEY.ACTIVE_DEVICE(userId),
      ROOM_REDIS_KEY.PRESENCE(roomId),
      String(userId),
      String(generation),
      String(socketId),
      previousActiveRaw || '',
      previousPresenceRaw || '',
      String(ROOM_SESSION_TTL_SECONDS)
    )
  ) === 1

const heartbeat = async ({ roomId, userId, socketId, deviceId, generation }) =>
  Number(
    await redisClient.eval(
      HEARTBEAT_LUA,
      2,
      ROOM_REDIS_KEY.ACTIVE_DEVICE(userId),
      ROOM_REDIS_KEY.PRESENCE(roomId),
      String(roomId),
      String(socketId),
      String(deviceId),
      String(generation),
      String(Date.now()),
      String(ROOM_SESSION_TTL_SECONDS),
      String(userId)
    )
  ) === 1

const releaseIfCurrent = async ({ roomId, userId, socketId, generation }) =>
  Number(
    await redisClient.eval(
      RELEASE_CURRENT_LUA,
      2,
      ROOM_REDIS_KEY.ACTIVE_DEVICE(userId),
      ROOM_REDIS_KEY.PRESENCE(roomId),
      String(roomId),
      String(socketId),
      String(generation),
      String(userId)
    )
  )

const listPresenceEntries = async (roomId) => {
  const values = await redisClient.hgetall(ROOM_REDIS_KEY.PRESENCE(roomId))
  return Object.entries(values).flatMap(([userId, raw]) => {
    const lease = parseJson(raw)
    return lease ? [{ userId, ...lease }] : []
  })
}

export default {
  claimJoin,
  getActiveDevice,
  isDeviceOwner,
  assertDeviceOwner,
  releaseDevice,
  removePresence,
  refreshPresence,
  forceRemovePresence,
  listPresenceUserIds,
  countPresence,
  rollbackClaim,
  heartbeat,
  releaseIfCurrent,
  listPresenceEntries
}
