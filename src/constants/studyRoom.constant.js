const ROOM_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private'
}

const ROOM_STATUS = {
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed'
}

const ROOM_ROLE = {
  HOST: 'host',
  MEMBER: 'member'
}

const POMODORO_PHASE = {
  WORK: 'work',
  BREAK: 'break'
}

const POMODORO_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused'
}

const ROOM_LIMITS = {
  TITLE_MAX: 200,
  MESSAGE_MAX: 500,
  ROOM_CODE_LENGTH: 10,
  ROOM_CODE_RETRY_MAX: 5,
  MAX_PARTICIPANTS_DEFAULT: 15,
  MAX_PARTICIPANTS_HARD: 15,
  MIN_PARTICIPANTS: 2,
  WORK_MIN: 5,
  WORK_MAX: 120,
  BREAK_MIN: 1,
  BREAK_MAX: 60,
  MESSAGE_PAGE_SIZE: 50,
  IDLE_CLOSE_MINUTES: 60,
  DISCONNECT_GRACE_MS: 20_000,
  DEVICE_ID_MIN: 8,
  DEVICE_ID_MAX: 128,
  JOIN_RESERVATION_SECONDS: 120,
  PRESENCE_STALE_SECONDS: 75,
  HEARTBEAT_SECONDS: 25,
  SWITCH_REQUEST_SECONDS: 60,
  SWITCH_REQUESTS_PER_MINUTE: 5,
  EMPTY_CLOSE_MINUTES: 10
}

const ROOM_REDIS_KEY = {
  // v3 dùng Hash thay cho Set.
  PRESENCE: (roomId) => `room:v3:${roomId}:presence`,
  ACTIVE_DEVICE: (userId) => `room:v3:user:${userId}:device`,
  DEVICE_GENERATION: (userId) => `room:v3:user:${userId}:generation`,
  CLOSE_LOCK: (roomId) => `room:v3:${roomId}:close-lock`,
  POMODORO: (roomId) => `room:v3:${roomId}:pomodoro`,
  LEADERBOARD: (roomId) => `room:v3:${roomId}:lb`,
  STUDY_MARK: (roomId, userId) => `room:v3:${roomId}:study:${userId}`,
  STUDY_MARK_INDEX: (roomId) => `room:v3:${roomId}:study-keys`,
  RL_CHAT: (userId) => `rl:chat:${userId}`,
  RL_SOCKET: (userId) => `rl:socket:${userId}`,
  RL_SWITCH: (userId) => `room:v3:rl:switch:${userId}`,
  SWITCH_REQUEST: (userId, requestId) => `room:v3:user:${userId}:switch:${requestId}`
}

const ROOM_REDIS_TTL_SECONDS = 60 * 60 * 24
const ROOM_DEVICE_TTL_SECONDS = 24 * 60 * 60
const ROOM_CLOSE_LOCK_SECONDS = 60
const ROOM_SESSION_TTL_SECONDS = ROOM_LIMITS.PRESENCE_STALE_SECONDS

export {
  ROOM_VISIBILITY,
  ROOM_STATUS,
  ROOM_ROLE,
  POMODORO_PHASE,
  POMODORO_STATUS,
  ROOM_LIMITS,
  ROOM_REDIS_KEY,
  ROOM_REDIS_TTL_SECONDS,
  ROOM_DEVICE_TTL_SECONDS,
  ROOM_CLOSE_LOCK_SECONDS,
  ROOM_SESSION_TTL_SECONDS
}
