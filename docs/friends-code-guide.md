# Coding guide tính năng Bạn bè

> **Dành cho:** Developer tự implement trong repo HITProduct  
> **Spec nghiệp vụ:** [`friends.md`](friends.md)  
> **Thứ tự công việc:** [`friends-implementation-plan.md`](friends-implementation-plan.md)  
> **Lưu ý:** Code dưới đây là starter code theo convention hiện tại của repo. Hãy viết/chạy test ở từng phần trước khi ghép phần tiếp theo.

Tài liệu này bổ sung phần còn thiếu của implementation plan: code cụ thể để bạn copy vào đúng file rồi hoàn thiện. Không copy toàn bộ một lần. Làm theo từng chặng, vì service phía sau phụ thuộc model và helper phía trước.

## 1. FR-01 — Constants, pair helper và User schema

### 1.1 `src/constants/social.constant.js`

```js
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
```

Thêm vào cuối `src/constants/index.js`:

```js
export * from './social.constant.js'
```

### 1.2 Bổ sung `src/constants/user.constant.js`

```js
const USER_LIMITS = {
  DISPLAY_NAME_MAX_LENGTH: 120,
  DEFAULT_QUIZ_SIZE: 10,
  QUIZ_SIZE_MIN: 1,
  QUIZ_SIZE_MAX: 100,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30
}

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$/
const USERNAME_RESERVED = Object.freeze(['admin', 'support', 'hitproduct', 'me', 'system'])

export { USER_LIMITS, USERNAME_PATTERN, USERNAME_RESERVED }
```

### 1.3 `src/utils/pairKey.js`

```js
import mongoose from 'mongoose'

const toPairKey = (idA, idB) => {
  const left = String(idA)
  const right = String(idB)

  if (!mongoose.isValidObjectId(left) || !mongoose.isValidObjectId(right)) {
    throw new TypeError('User id không hợp lệ.')
  }
  if (left === right) {
    throw new TypeError('Hai user trong một cặp phải khác nhau.')
  }

  const [userA, userB] = [left, right].sort()
  return { userA, userB }
}

export { toPairKey }
export default toPairKey
```

### 1.4 Sửa `src/models/user.model.js`

Đổi import:

```js
import {
  ACTIVITY_VISIBILITY,
  FRIEND_REQUEST_POLICY,
  USER_LIMITS
} from '../constants/index.js'
```

Thêm các field vào schema, ngay sau `displayName`:

```js
username: {
  type: String,
  default: null,
  trim: true,
  lowercase: true,
  minlength: USER_LIMITS.USERNAME_MIN_LENGTH,
  maxlength: USER_LIMITS.USERNAME_MAX_LENGTH
},
usernameUpdatedAt: {
  type: Date,
  default: null
},
activityVisibility: {
  type: String,
  enum: Object.values(ACTIVITY_VISIBILITY),
  default: ACTIVITY_VISIBILITY.FRIENDS
},
friendRequestPolicy: {
  type: String,
  enum: Object.values(FRIEND_REQUEST_POLICY),
  default: FRIEND_REQUEST_POLICY.EVERYONE
},
```

Thêm index trước dòng export model:

```js
userSchema.index({ username: 1 }, { unique: true, sparse: true })
userSchema.index({ displayName: 'text' })
```

### 1.5 Test helper

`test/social/pairKey.test.js`:

```js
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { toPairKey } from '../../src/utils/pairKey.js'

describe('toPairKey', () => {
  const first = '64b000000000000000000001'
  const second = '64b000000000000000000002'

  test('trả cùng pair dù đảo thứ tự input', () => {
    assert.deepEqual(toPairKey(first, second), toPairKey(second, first))
    assert.deepEqual(toPairKey(second, first), { userA: first, userB: second })
  })

  test('từ chối cặp gồm cùng một user', () => {
    assert.throws(() => toPairKey(first, first), /phải khác nhau/)
  })

  test('từ chối ObjectId không hợp lệ', () => {
    assert.throws(() => toPairKey('invalid', second), /không hợp lệ/)
  })
})
```

Chạy:

```powershell
node --test test/social/pairKey.test.js
```

## 2. FR-02 — Username và privacy

### 2.1 Helper username trong `src/services/client/user.service.js`

Thêm import:

```js
import {
  SOCIAL_LIMITS,
  USERNAME_PATTERN,
  USERNAME_RESERVED
} from '../../constants/index.js'
```

Thêm các hàm:

```js
const normalizeUsername = (value) => String(value || '').trim().toLowerCase()

const validateUsername = (value) => {
  const username = normalizeUsername(value)

  if (!USERNAME_PATTERN.test(username) || username.includes('..') || username.includes('__')) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Username không đúng định dạng.')
  }
  if (USERNAME_RESERVED.includes(username)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Username này không được phép sử dụng.')
  }
  return username
}

const setUsername = async (userId, rawUsername) => {
  const username = validateUsername(rawUsername)
  const user = await userModel.findById(userId).select('username usernameUpdatedAt')
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy người dùng.')

  if (user.username === username) return userModel.findById(userId).select('-passwordHash -__v')

  if (user.usernameUpdatedAt) {
    const nextAllowedAt = new Date(user.usernameUpdatedAt)
    nextAllowedAt.setUTCDate(nextAllowedAt.getUTCDate() + SOCIAL_LIMITS.USERNAME_CHANGE_COOLDOWN_DAYS)
    if (nextAllowedAt > new Date()) {
      const error = new ApiError(StatusCodes.CONFLICT, 'Chưa đến thời điểm được đổi username.')
      error.nextAllowedAt = nextAllowedAt
      throw error
    }
  }

  try {
    return await userModel
      .findByIdAndUpdate(
        userId,
        { $set: { username, usernameUpdatedAt: new Date() } },
        { new: true, runValidators: true }
      )
      .select('-passwordHash -__v')
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(StatusCodes.CONFLICT, 'Username đã được sử dụng.')
    }
    throw error
  }
}

const isUsernameAvailable = async (rawUsername, currentUserId) => {
  const username = validateUsername(rawUsername)
  const exists = await userModel.exists({
    username,
    _id: { $ne: currentUserId }
  })
  return { username, available: !exists }
}

const updatePrivacy = async (userId, data) => {
  const update = {}
  if (data.activityVisibility !== undefined) update.activityVisibility = data.activityVisibility
  if (data.friendRequestPolicy !== undefined) update.friendRequestPolicy = data.friendRequestPolicy

  const user = await userModel
    .findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
    .select('username activityVisibility friendRequestPolicy')

  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy người dùng.')
  return user
}
```

Nhớ export ba hàm mới trong object default. Đồng thời đổi:

```js
const allowedFields = ['displayName', 'defaultQuizSize']
```

để `avatarUrl` chỉ được cập nhật qua route upload/remove riêng.

### 2.2 Validation

Thêm vào `src/validations/client/user.validation.js`:

```js
import {
  ACTIVITY_VISIBILITY,
  FRIEND_REQUEST_POLICY,
  USER_LIMITS,
  USERNAME_PATTERN
} from '../../constants/index.js'

const updateUsername = {
  body: Joi.object({
    username: Joi.string()
      .trim()
      .lowercase()
      .min(USER_LIMITS.USERNAME_MIN_LENGTH)
      .max(USER_LIMITS.USERNAME_MAX_LENGTH)
      .pattern(USERNAME_PATTERN)
      .required()
  })
}

const usernameAvailable = {
  query: Joi.object({
    username: Joi.string().trim().lowercase().required()
  })
}

const updatePrivacy = {
  body: Joi.object({
    activityVisibility: Joi.string().valid(...Object.values(ACTIVITY_VISIBILITY)),
    friendRequestPolicy: Joi.string().valid(...Object.values(FRIEND_REQUEST_POLICY))
  }).min(1)
}
```

Export các schema này trong object default.

### 2.3 Controller và route

Thêm vào `src/controllers/client/user.controller.js`:

```js
const updateUsername = catchAsync(async (req, res) => {
  const user = await userService.setUsername(req.user._id, req.body.username)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật username thành công.', user))
})

const checkUsernameAvailable = catchAsync(async (req, res) => {
  const data = await userService.isUsernameAvailable(req.query.username, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Kiểm tra username thành công.', data))
})

const updatePrivacy = catchAsync(async (req, res) => {
  const data = await userService.updatePrivacy(req.user._id, req.body)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Cập nhật quyền riêng tư thành công.', data))
})
```

Thêm vào object export, rồi khai báo route trước mọi route `/:userId`:

```js
userRouter.get(
  '/username-available',
  validateMiddleware(userValidation.usernameAvailable),
  userController.checkUsernameAvailable
)
userRouter.put(
  '/me/username',
  validateMiddleware(userValidation.updateUsername),
  userController.updateUsername
)
userRouter.put(
  '/me/privacy',
  validateMiddleware(userValidation.updatePrivacy),
  userController.updatePrivacy
)
```

## 3. FR-04 — Friendship và block models

### 3.1 `src/models/friendship.model.js`

```js
import mongoose, { model } from 'mongoose'

import { FRIENDSHIP_STATUS } from '../constants/index.js'

const friendshipSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addresseeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(FRIENDSHIP_STATUS),
      required: true
    },
    requestedAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true })
friendshipSchema.index({ userA: 1, status: 1, respondedAt: -1 })
friendshipSchema.index({ userB: 1, status: 1, respondedAt: -1 })
friendshipSchema.index({ addresseeId: 1, status: 1, requestedAt: -1 })
friendshipSchema.index({ requesterId: 1, status: 1, requestedAt: -1 })

export default model('Friendship', friendshipSchema)
```

### 3.2 `src/models/userBlock.model.js`

```js
import mongoose, { model } from 'mongoose'

const userBlockSchema = new mongoose.Schema(
  {
    blockerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blockedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true })
userBlockSchema.index({ blockedId: 1 })

export default model('UserBlock', userBlockSchema)
```

Import/export cả hai model trong `src/models/index.js`.

### 3.3 Relationship resolver thuần

`src/services/client/friendRelationship.js`:

```js
import { FRIENDSHIP_STATUS, RELATIONSHIP_STATE } from '../../constants/index.js'

const sameId = (left, right) => String(left) === String(right)

const resolveRelationshipState = ({ friendship, blockByMe, blockMe, meId }) => {
  if (blockByMe) return RELATIONSHIP_STATE.BLOCKED_BY_ME
  if (blockMe) return RELATIONSHIP_STATE.BLOCKED_ME
  if (!friendship) return RELATIONSHIP_STATE.NONE
  if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) return RELATIONSHIP_STATE.FRIENDS

  if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
    return sameId(friendship.requesterId, meId)
      ? RELATIONSHIP_STATE.OUTGOING_PENDING
      : RELATIONSHIP_STATE.INCOMING_PENDING
  }

  return RELATIONSHIP_STATE.NONE
}

const canSendRequest = (friendship, now = new Date(), cooldownHours = 24) => {
  if (!friendship) return { allowed: true }
  if (friendship.status !== FRIENDSHIP_STATUS.DECLINED) return { allowed: false }

  const retryAt = new Date(friendship.respondedAt)
  retryAt.setUTCHours(retryAt.getUTCHours() + cooldownHours)
  return retryAt <= now
    ? { allowed: true }
    : { allowed: false, retryAt, retryAfterSeconds: Math.ceil((retryAt - now) / 1000) }
}

export { resolveRelationshipState, canSendRequest }
```

## 4. FR-05 — Friend service core

Đây là phần dễ lỗi race condition nhất. Không dùng `findOne()` rồi `save()` cho accept/decline. Dùng compare-and-set với current status.

### 4.1 Gửi lời mời và xử lý lời mời chéo

Khung cho `src/services/client/friend.service.js`:

```js
import { StatusCodes } from 'http-status-codes'

import {
  FRIENDSHIP_STATUS,
  FRIEND_REQUEST_POLICY,
  SOCIAL_LIMITS
} from '../../constants/index.js'
import { friendshipModel, userBlockModel, userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { toPairKey } from '../../utils/pairKey.js'
import { canSendRequest } from './friendRelationship.js'

const hasBlockBetween = async (userId, targetId) =>
  Boolean(
    await userBlockModel.exists({
      $or: [
        { blockerId: userId, blockedId: targetId },
        { blockerId: targetId, blockedId: userId }
      ]
    })
  )

const assertTargetCanReceiveRequest = async (userId, targetId) => {
  if (String(userId) === String(targetId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Không thể gửi lời mời cho chính mình.')
  }

  const target = await userModel
    .findById(targetId)
    .select('_id friendRequestPolicy')
    .lean()
  if (!target || (await hasBlockBetween(userId, targetId))) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy người dùng.')
  }
  if (target.friendRequestPolicy === FRIEND_REQUEST_POLICY.NOBODY) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Người dùng hiện không nhận lời mời kết bạn.')
  }
}

const sendRequest = async (requesterId, addresseeId) => {
  await assertTargetCanReceiveRequest(requesterId, addresseeId)
  const { userA, userB } = toPairKey(requesterId, addresseeId)
  const now = new Date()

  const existing = await friendshipModel.findOne({ userA, userB })
  if (existing?.status === FRIENDSHIP_STATUS.ACCEPTED) {
    throw new ApiError(StatusCodes.CONFLICT, 'Hai người đã là bạn bè.')
  }

  if (existing?.status === FRIENDSHIP_STATUS.PENDING) {
    if (String(existing.requesterId) === String(requesterId)) {
      throw new ApiError(StatusCodes.CONFLICT, 'Lời mời đã được gửi trước đó.')
    }

    const accepted = await friendshipModel.findOneAndUpdate(
      {
        _id: existing._id,
        status: FRIENDSHIP_STATUS.PENDING,
        requesterId: addresseeId,
        addresseeId: requesterId
      },
      {
        $set: {
          status: FRIENDSHIP_STATUS.ACCEPTED,
          respondedAt: now
        }
      },
      { new: true }
    )
    if (accepted) return { friendship: accepted, autoAccepted: true }

    return sendRequest(requesterId, addresseeId)
  }

  if (existing?.status === FRIENDSHIP_STATUS.DECLINED) {
    const retry = canSendRequest(existing, now, SOCIAL_LIMITS.REQUEST_RESEND_COOLDOWN_HOURS)
    if (!retry.allowed) {
      const error = new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Hãy chờ trước khi gửi lại lời mời.')
      error.retryAfterSeconds = retry.retryAfterSeconds
      throw error
    }

    const reopened = await friendshipModel.findOneAndUpdate(
      { _id: existing._id, status: FRIENDSHIP_STATUS.DECLINED },
      {
        $set: {
          requesterId,
          addresseeId,
          status: FRIENDSHIP_STATUS.PENDING,
          requestedAt: now,
          respondedAt: null
        }
      },
      { new: true }
    )
    if (!reopened) return sendRequest(requesterId, addresseeId)
    return { friendship: reopened, autoAccepted: false }
  }

  try {
    const friendship = await friendshipModel.create({
      userA,
      userB,
      requesterId,
      addresseeId,
      status: FRIENDSHIP_STATUS.PENDING,
      requestedAt: now
    })
    return { friendship, autoAccepted: false }
  } catch (error) {
    if (error?.code === 11000) return sendRequest(requesterId, addresseeId)
    throw error
  }
}

const acceptRequest = async (requestId, addresseeId) => {
  const friendship = await friendshipModel.findOneAndUpdate(
    {
      _id: requestId,
      addresseeId,
      status: FRIENDSHIP_STATUS.PENDING
    },
    {
      $set: {
        status: FRIENDSHIP_STATUS.ACCEPTED,
        respondedAt: new Date()
      }
    },
    { new: true }
  )

  if (friendship) return friendship

  const owned = await friendshipModel.findOne({ _id: requestId, addresseeId }).select('status').lean()
  if (!owned) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy lời mời.')
  throw new ApiError(StatusCodes.CONFLICT, 'Lời mời không còn ở trạng thái chờ.')
}

export default { sendRequest, acceptRequest }
```

Bạn cần bổ sung trước khi coi service hoàn chỉnh:

- count và giới hạn `MAX_FRIENDS`, `MAX_PENDING_OUTGOING`;
- `declineRequest`, `cancelRequest`, `unfriend` theo cùng mẫu compare-and-set;
- list friend/request bằng query theo tập id;
- notification chỉ ghi sau khi transition DB thành công;
- không dùng recursion vô hạn trong production: thay phần retry bằng vòng lặp có tối đa 2–3 lần.

### 4.2 Controller pattern

```js
const sendRequest = catchAsync(async (req, res) => {
  const data = await friendService.sendRequest(req.user._id, req.body.userId)
  res
    .status(StatusCodes.CREATED)
    .json(response(StatusCodes.CREATED, 'Gửi lời mời kết bạn thành công.', data))
})

const acceptRequest = catchAsync(async (req, res) => {
  const data = await friendService.acceptRequest(req.params.id, req.user._id)
  res.status(StatusCodes.OK).json(response(StatusCodes.OK, 'Chấp nhận lời mời thành công.', data))
})
```

## 5. FR-07 — Presence code

Mỗi socket dùng một field trong Redis hash của user. Khi một tab disconnect, chỉ xóa field của socket đó.

`src/services/client/presence.service.js`:

```js
import { redisClient } from '../../configs/index.js'
import { PRESENCE_STATUS, SOCIAL_LIMITS, SOCIAL_REDIS_KEY } from '../../constants/index.js'
import { logger } from '../../utils/index.js'

const aggregateStatus = (statuses) => {
  if (statuses.includes(PRESENCE_STATUS.ONLINE)) return PRESENCE_STATUS.ONLINE
  if (statuses.includes(PRESENCE_STATUS.IDLE)) return PRESENCE_STATUS.IDLE
  return PRESENCE_STATUS.OFFLINE
}

const setConnection = async (userId, socketId, status = PRESENCE_STATUS.ONLINE) => {
  const key = SOCIAL_REDIS_KEY.PRESENCE(userId)
  const pipeline = redisClient.pipeline()
  pipeline.hset(key, socketId, JSON.stringify({ status, seenAt: Date.now() }))
  pipeline.expire(key, SOCIAL_LIMITS.PRESENCE_STALE_SECONDS)
  await pipeline.exec()
}

const heartbeat = (userId, socketId, status) => setConnection(userId, socketId, status)

const clearConnection = async (userId, socketId) => {
  const key = SOCIAL_REDIS_KEY.PRESENCE(userId)
  await redisClient.hdel(key, socketId)
  const remaining = await redisClient.hlen(key)
  if (remaining > 0) await redisClient.expire(key, SOCIAL_LIMITS.PRESENCE_STALE_SECONDS)
}

const parseAggregate = (raw) => {
  const statuses = Object.values(raw).flatMap((value) => {
    try {
      return [JSON.parse(value).status]
    } catch {
      return []
    }
  })
  return aggregateStatus(statuses)
}

const getPresenceMap = async (userIds) => {
  const ids = [...new Set(userIds.map(String))]
  const fallback = new Map(ids.map((id) => [id, PRESENCE_STATUS.OFFLINE]))
  if (ids.length === 0) return fallback

  try {
    const pipeline = redisClient.pipeline()
    for (const id of ids) pipeline.hgetall(SOCIAL_REDIS_KEY.PRESENCE(id))
    const results = await pipeline.exec()

    return new Map(
      ids.map((id, index) => {
        const [error, raw] = results[index]
        return [id, error ? PRESENCE_STATUS.OFFLINE : parseAggregate(raw || {})]
      })
    )
  } catch (error) {
    logger.warn(`Presence unavailable: ${error.message}`)
    return fallback
  }
}

const countOnline = async (userIds) => {
  const map = await getPresenceMap(userIds)
  return [...map.values()].filter((status) => status !== PRESENCE_STATUS.OFFLINE).length
}

export { aggregateStatus, setConnection, heartbeat, clearConnection, getPresenceMap, countOnline }
export default { setConnection, heartbeat, clearConnection, getPresenceMap, countOnline }
```

Lưu ý: TTL trên hash chỉ phản ánh heartbeat gần nhất của toàn user. Để loại chính xác connection đã stale trong khi connection khác vẫn heartbeat, production code nên lưu `seenAt` và lọc entry quá hạn trong `parseAggregate`, sau đó dọn field stale định kỳ hoặc trong heartbeat.

## 6. FR-08 — Notification model

`src/models/notification.model.js`:

```js
import mongoose, { model } from 'mongoose'

import { NOTIFICATION_TYPE } from '../constants/index.js'

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
    entityType: { type: String, default: null },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    dedupKey: { type: String, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })
notificationSchema.index(
  { userId: 1, dedupKey: 1 },
  { unique: true, partialFilterExpression: { dedupKey: { $type: 'string' } } }
)

export default model('Notification', notificationSchema)
```

Service create nên dùng upsert để retry không tạo trùng:

```js
const createNotification = async ({ userId, actorId, type, entityType, entityId, dedupKey, data = {} }) =>
  notificationModel.findOneAndUpdate(
    { userId, dedupKey },
    {
      $setOnInsert: {
        userId,
        actorId,
        type,
        entityType,
        entityId,
        dedupKey,
        data,
        readAt: null
      }
    },
    { new: true, upsert: true }
  )
```

Chỉ emit socket sau khi promise trên resolve thành công.

## 7. FR-09 — Conversation và DirectMessage models

### 7.1 `src/models/conversation.model.js`

```js
import mongoose, { model } from 'mongoose'

import { SOCIAL_LIMITS } from '../constants/index.js'

const conversationSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: null, maxlength: SOCIAL_LIMITS.DM_PREVIEW_MAX }
  },
  { timestamps: true }
)

conversationSchema.index({ userA: 1, userB: 1 }, { unique: true })
conversationSchema.index({ userA: 1, lastMessageAt: -1 })
conversationSchema.index({ userB: 1, lastMessageAt: -1 })

export default model('Conversation', conversationSchema)
```

### 7.2 `src/models/conversationMember.model.js`

```js
import mongoose, { model } from 'mongoose'

const conversationMemberSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    unreadCount: { type: Number, default: 0, min: 0 },
    lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'DirectMessage', default: null },
    lastReadAt: { type: Date, default: null }
  },
  { timestamps: true }
)

conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true })
conversationMemberSchema.index({ userId: 1, updatedAt: -1 })

export default model('ConversationMember', conversationMemberSchema)
```

### 7.3 `src/models/directMessage.model.js`

```js
import mongoose, { model } from 'mongoose'

import { SOCIAL_LIMITS } from '../constants/index.js'

const directMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientMessageId: {
      type: String,
      required: true,
      trim: true,
      maxlength: SOCIAL_LIMITS.CLIENT_MESSAGE_ID_MAX
    },
    body: { type: String, required: true, trim: true, maxlength: SOCIAL_LIMITS.DM_BODY_MAX }
  },
  { timestamps: true }
)

directMessageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true }
)
directMessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 })

export default model('DirectMessage', directMessageSchema)
```

Khi gửi tin:

1. Xác nhận sender là member, hai user vẫn là bạn và không có block.
2. `create()` message trước.
3. Nếu `E11000`, đọc message theo dedup key và trả lại với `deduped: true`; không tăng unread.
4. Nếu message mới, update conversation preview và `$inc` unread của người nhận.
5. Ghi notification.
6. Emit socket sau cùng.

## 8. FR-11 — ActivityEvent model và best-effort recorder

`src/models/activityEvent.model.js`:

```js
import mongoose, { model } from 'mongoose'

import { ACTIVITY_EVENT_TYPE, ACTIVITY_VISIBILITY } from '../constants/index.js'

const activityEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(ACTIVITY_EVENT_TYPE), required: true },
    visibility: {
      type: String,
      enum: Object.values(ACTIVITY_VISIBILITY),
      default: ACTIVITY_VISIBILITY.FRIENDS
    },
    deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', default: null },
    deckTitle: { type: String, default: null },
    score: { type: Number, default: null },
    streakDays: { type: Number, default: null },
    dedupKey: { type: String, required: true },
    occurredAt: { type: Date, required: true }
  },
  { timestamps: true }
)

activityEventSchema.index({ userId: 1, occurredAt: -1 })
activityEventSchema.index({ userId: 1, dedupKey: 1 }, { unique: true })

export default model('ActivityEvent', activityEventSchema)
```

`src/services/client/activityEvent.service.js`:

```js
import { activityEventModel } from '../../models/index.js'
import { logger } from '../../utils/index.js'

const recordActivityEvent = async (event) => {
  try {
    const document = await activityEventModel.findOneAndUpdate(
      { userId: event.userId, dedupKey: event.dedupKey },
      { $setOnInsert: event },
      { new: true, upsert: true }
    )
    logger.info(`event=activity.recorded userId=${event.userId} type=${event.type}`)
    return document
  } catch (error) {
    logger.warn(
      `event=activity.record_failed userId=${event.userId} type=${event.type} reason=${error.message}`
    )
    return null
  }
}

export { recordActivityEvent }
export default { recordActivityEvent }
```

Ví dụ sau khi quiz đã `save()` thành công:

```js
void recordActivityEvent({
  userId,
  type: ACTIVITY_EVENT_TYPE.QUIZ_COMPLETED,
  visibility: ACTIVITY_VISIBILITY.FRIENDS,
  deckId,
  deckTitle: deck.title,
  score: attempt.score,
  dedupKey: `quiz_completed:${attempt._id}`,
  occurredAt: attempt.submittedAt
})
```

Nếu cần chắc chắn log được lỗi trước khi request kết thúc, dùng `await recordActivityEvent(...)`; helper đã tự nuốt lỗi nên request quiz vẫn không fail.

## 9. Barrel export checklist

Mỗi khi tạo module, cập nhật đúng barrel:

```text
src/constants/index.js
src/models/index.js
src/validations/client/index.js
src/services/client/index.js
src/controllers/client/index.js
src/routers/client/index.js
```

Ví dụ model barrel:

```js
import friendshipModel from './friendship.model.js'
import userBlockModel from './userBlock.model.js'
import notificationModel from './notification.model.js'
import conversationModel from './conversation.model.js'
import conversationMemberModel from './conversationMember.model.js'
import directMessageModel from './directMessage.model.js'
import activityEventModel from './activityEvent.model.js'

export {
  friendshipModel,
  userBlockModel,
  notificationModel,
  conversationModel,
  conversationMemberModel,
  directMessageModel,
  activityEventModel
}
```

Ghép các tên này vào export đang có, không thay thế các model cũ.

## 10. Thứ tự bạn nên code

Không nên copy toàn bộ tài liệu rồi mới chạy. Làm theo thứ tự:

1. Copy mục 1, chạy `pairKey.test.js`, kiểm tra app import được.
2. Làm mục 2, tự viết test username duplicate/cooldown trước khi thêm route.
3. Tạo model ở mục 3, dùng `schema.indexes()` kiểm tra index.
4. Hoàn thiện friend service ở mục 4 và toàn bộ case mục 16.2 của spec.
5. Chỉ sau khi friend service ổn định mới thêm presence và notification.
6. Tạo đủ ba model DM trước khi viết socket handler.
7. Activity feed làm sau cùng vì phụ thuộc friend/block/privacy.
8. Cuối mỗi chặng chạy test hẹp; cuối toàn bộ chạy `npm test`.

Các phần chưa nên copy nguyên xi mà phải tự hoàn thiện theo spec:

- transaction/compensation khi một thao tác cần ghi nhiều collection;
- friend summary đầy đủ;
- pagination response mapping;
- socket handler và ack contract;
- block cleanup xuyên tất cả collection;
- cursor message pagination;
- activity feed aggregation.

Những phần này liên quan trực tiếp đến quyết định consistency và error contract. Mẫu ở trên cung cấp model, helper và luồng chính; `docs/friends.md` cung cấp contract bắt buộc để bạn hoàn thiện chúng.
