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
  MAX_PARTICIPANTS_DEFAULT: 20,
  MAX_PARTICIPANTS_HARD: 50,
  MIN_PARTICIPANTS: 2,
  WORK_MIN: 5,
  WORK_MAX: 120,
  BREAK_MIN: 1,
  BREAK_MAX: 60,
  MESSAGE_PAGE_SIZE: 50,
  IDLE_CLOSE_MINUTES: 60,
  DISCONNECT_GRACE_MS: 20_000,
  DEVICE_ID_MIN: 8,
  DEVICE_ID_MAX: 128
}

const ROOM_REDIS_KEY = {
  // v2 dùng Hash thay cho Set.
  PRESENCE: (roomId) => `room:v2:${roomId}:presence`,
  ACTIVE_DEVICE: (userId) => `room:user-session:${userId}`,
  DEVICE_GENERATION: (userId) => `room:user-generation:${userId}`,
  CLOSE_LOCK: (roomId) => `room:${roomId}:close-lock`,
  POMODORO: (roomId) => `room:${roomId}:pomodoro`,
  LEADERBOARD: (roomId) => `room:${roomId}:lb`,
  STUDY_MARK: (roomId, userId) => `room:${roomId}:study:${userId}`,
  STUDY_MARK_INDEX: (roomId) => `room:${roomId}:study-keys`,
  RL_CHAT: (userId) => `rl:chat:${userId}`,
  RL_SOCKET: (userId) => `rl:socket:${userId}`
}

const ROOM_REDIS_TTL_SECONDS = 60 * 60 * 24
const ROOM_DEVICE_TTL_SECONDS = 24 * 60 * 60
const ROOM_CLOSE_LOCK_SECONDS = 60

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
  ROOM_CLOSE_LOCK_SECONDS
}
