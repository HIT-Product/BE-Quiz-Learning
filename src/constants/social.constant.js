const FRIENDSHIP_STATUS = Object.freeze({
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined'
})

const RELATIONSHIP_STATE = Object.freeze({
    NONE: 'none',
    OUTGOING_PENDING: 'outgoing_pending',
    INCOMING_PENDING: 'incoming_pending',
    FRIENDS: 'friends',
    BLOCKED_BY_ME: 'blocked_by_me',
    BLOCKED_ME: 'blocked_me'
})

const ACTIVITY_VISIBILITY = Object.freeze({
    FRIENDS: 'friends',
    PRIVATE: 'private'
})

const FRIEND_REQUEST_POLICY = Object.freeze({
    EVERYONE: 'everyone',
    NOBODY: 'nobody'
})

const PRESENCE_STATUS = Object.freeze({
    ONLINE: 'online',
    IDLE: 'idle',
    OFFLINE: 'offline'
})

const NOTIFICATION_TYPE = Object.freeze({
    FRIEND_REQUEST_RECEIVED: 'friend_request_received',
    FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',
    DIRECT_MESSAGE: 'direct_message'
})

const ACTIVITY_EVENT_TYPE = Object.freeze({
    QUIZ_COMPLETED: 'quiz_completed',
    QUIZ_HIGH_SCORE: 'quiz_high_score',
    LEARN_STARTED: 'learn_started',
    STREAK_REACHED: 'streak_reached'
})

const SOCIAL_LIMITS = Object.freeze({
    PAGE_DEFAULT: 1,
    PAGE_LIMIT_DEFAULT: 20,
    PAGE_LIMIT_MAX: 50,
    MAX_FRIENDS: 500,
    MAX_PENDING_OUTGOING: 100,
    MAX_BLOCKED: 500,
    REQUEST_RESEND_COOLDOWN_HOURS: 24,
    USERNAME_CHANGE_COOLDOWN_DAYS: 30,
    DM_BODY_MAX: 2000,
    DM_PREVIEW_MAX: 160,
    CLIENT_MESSAGE_ID_MAX: 100,
    PRESENCE_STALE_SECONDS: 70,
    PRESENCE_HEARTBEAT_SECONDS: 25,
    PRESENCE_FANOUT_MAX_FRIENDS: 500,
    ACTIVITY_FEED_MAX_FRIENDS: 500,
    HIGH_SCORE_THRESHOLD: 80
})

const SOCIAL_REDIS_KEY = Object.freeze({
    PRESENCE: (userId) => `social:v1:presence:${userId}`,
    PRESENCE_CONNECTION: (userId, socketId) => `social:v1:presence:${userId}:${socketId}`,
    RL_FRIEND_REQUEST: (userId) => `rl:friend-request:${userId}`,
    RL_USER_SEARCH: (userId) => `rl:user-search:${userId}`,
    RL_USERNAME: (userId) => `rl:username:${userId}`,
    RL_DM: (userId) => `rl:dm:${userId}`,
    RL_BLOCK: (userId) => `rl:block:${userId}`
})

const SOCIAL_SOCKET_EVENT = Object.freeze({
    PRESENCE_HEARTBEAT: 'presence:heartbeat',
    PRESENCE_CHANGED: 'presence:changed',
    FRIEND_REQUEST_RECEIVED: 'friend:request-received',
    FRIEND_REQUEST_ACCEPTED: 'friend:request-accepted',
    FRIEND_REMOVED: 'friend:removed',
    NOTIFICATION_NEW: 'notification:new',
    DM_SEND: 'dm:send',
    DM_NEW: 'dm:new',
    DM_READ: 'dm:read',
    DM_TYPING: 'dm:typing'
})

export {
    FRIENDSHIP_STATUS,
    RELATIONSHIP_STATE,
    ACTIVITY_VISIBILITY,
    FRIEND_REQUEST_POLICY,
    PRESENCE_STATUS,
    NOTIFICATION_TYPE,
    ACTIVITY_EVENT_TYPE,
    SOCIAL_LIMITS,
    SOCIAL_REDIS_KEY,
    SOCIAL_SOCKET_EVENT
}