# Hướng dẫn build tính năng Bạn bè cho HITProduct

> **Trạng thái:** Canonical - dùng để triển khai backend tính năng Bạn bè
> **Cập nhật:** 2026-08-04
> **Phạm vi:** Backend Express/Mongoose/Redis/Socket.IO. Frontend chỉ được nhắc tới ở mức contract.
> **Nguồn yêu cầu:** Màn hình `Bạn bè` trong bản thiết kế QuizLearning (danh sách bạn bè, lời mời kết bạn, hoạt động gần đây, nhắn tin, chặn người dùng)

Tài liệu này bám theo cách tổ chức của `docs/dashboard.md`: chốt phạm vi trước, xác định nguồn sự thật, định nghĩa contract, lập bản đồ file, triển khai theo thứ tự phụ thuộc, sau đó mới kiểm thử và rollout.

## 1. Cách sử dụng

Thực hiện tuần tự theo 6 phase:

1. Định danh người dùng: thêm `username`, backfill và API tìm bạn.
2. Quan hệ bạn bè: model, state machine, lời mời, chặn người dùng.
3. Presence: Socket.IO namespace `/social` và trạng thái online qua Redis.
4. Thông báo: model notification và realtime khi có lời mời hoặc phản hồi.
5. Nhắn tin 1-1: conversation, message, đọc tin, realtime.
6. Hoạt động gần đây: activity event, quyền riêng tư và feed bạn bè.

Mỗi phase chỉ được xem là hoàn thành khi:

- contract response đã có test;
- dữ liệu của user này không thể lẫn sang user khác;
- empty state trả `200` với số `0` và mảng rỗng;
- quan hệ hai chiều không thể tồn tại hai bản ghi trùng cho cùng một cặp user;
- người bị chặn không xuất hiện trong bất kỳ truy vấn bạn bè, lời mời, feed hoặc tin nhắn mới;
- một lỗi giữa luồng không tạo dữ liệu nửa vời (ví dụ đã accept nhưng không có conversation).

Không triển khai group chat, friend suggestion theo thuật toán, hay leaderboard bạn bè trong tài liệu này. Từ `Bạn bè` bên dưới luôn có nghĩa là quan hệ 1-1 đối xứng đã được xác nhận.

## 2. Phạm vi MVP đã chốt

Người dùng đã đăng nhập có thể:

1. Đặt và đổi `username` (định danh dạng `@huy.tran`), kiểm tra username còn trống.
2. Tìm người dùng khác theo `username`, `displayName` hoặc email chính xác.
3. Gửi lời mời kết bạn, hủy lời mời đã gửi.
4. Xem lời mời đến và lời mời đã gửi, kèm tổng số lời mời chờ xử lý.
5. Chấp nhận hoặc từ chối lời mời đến.
6. Xem danh sách bạn bè có phân trang, kèm trạng thái online/idle/offline.
7. Hủy kết bạn.
8. Chặn và bỏ chặn người dùng, xem danh sách đã chặn.
9. Nhận thông báo realtime khi có lời mời mới hoặc lời mời được chấp nhận.
10. Nhắn tin 1-1 với bạn bè, xem lịch sử tin nhắn, đánh dấu đã đọc, đếm tin chưa đọc.
11. Xem hoạt động học tập gần đây của bạn bè và tắt chia sẻ hoạt động của mình.

Ngoài phạm vi MVP:

- Group chat, nhóm học tập, kênh chat nhiều người ngoài phòng học ảo.
- Gợi ý kết bạn theo bạn chung hoặc theo deck chung.
- Bảng xếp hạng giữa bạn bè.
- Gửi ảnh, file, emoji reaction, sửa tin nhắn đã gửi.
- Cuộc gọi thoại hoặc video ngoài phòng học ảo.
- Báo cáo người dùng (report) và luồng xử lý của admin.
- Đồng bộ danh bạ hoặc mời bạn qua email.
- Push notification qua FCM/APNs; MVP chỉ có in-app notification.

Các phần ngoài phạm vi chỉ được thêm sau khi MVP đã đúng dữ liệu và đạt test hiệu năng.

## 3. Trạng thái hiện tại

### 3.1 Những gì đã có

- `User` đã có `email`, `passwordHash`, `displayName`, `avatarUrl`, `defaultQuizSize` và `timestamps` tại [src/models/user.model.js](src/models/user.model.js).
- Auth theo access token và `Session` đã hoạt động; `authMiddleware` gắn `req.user._id`.
- Redis đã sẵn sàng qua [src/configs/redis.config.js](src/configs/redis.config.js) và đã được dùng cho rate limit lẫn presence phòng học.
- Socket.IO đã được khởi tạo tại [src/sockets/index.js](src/sockets/index.js) với namespace `/study-rooms`, có `socketAuthMiddleware` xác thực bằng access token và `deviceId`.
- Đã có mẫu chuẩn cho realtime: `safeHandler`/`socketError` tại [src/sockets/utils/socketHandler.js](src/sockets/utils/socketHandler.js), contract event tại [src/sockets/contracts/room.contract.js](src/sockets/contracts/room.contract.js), chat kèm rate limit tại [src/sockets/handlers/chat.handler.js](src/sockets/handlers/chat.handler.js).
- Đã có mẫu model tin nhắn kèm dedup theo `clientMessageId` tại [src/models/roomMessage.model.js](src/models/roomMessage.model.js).
- Đã có `StudyActivity` ghi nhận ngày học và `STUDY_ACTIVITY_SOURCE` tại [src/services/client/studyActivity.service.js](src/services/client/studyActivity.service.js).
- Đã có mẫu phân trang `{ items, pagination: { page, limit, total } }` tại [src/services/client/studyRoom.service.js:80-95](src/services/client/studyRoom.service.js#L80-L95).
- Wrapper response chuẩn `{ statusCode, message, data }` tại [src/utils/response.js](src/utils/response.js).
- Rate limit theo user hoặc IP tại [src/middlewares/rateLimit.middleware.js](src/middlewares/rateLimit.middleware.js).

### 3.2 Những gì còn thiếu

- `User` chưa có `username`, nên không thể hiển thị hay tìm theo `@handle`.
- `User` chưa có cấu hình quyền riêng tư cho hoạt động học tập.
- Chưa có bất kỳ model quan hệ giữa hai user: không có friendship, friend request, block.
- Chưa có model notification.
- Chưa có conversation và direct message; chat hiện tại chỉ tồn tại trong phạm vi một `StudyRoom`.
- Presence hiện tại chỉ tính trong một phòng học (`ROOM_REDIS_KEY.PRESENCE(roomId)`), không phản ánh việc user có đang mở app hay không.
- Chưa có namespace socket nào ngoài `/study-rooms`, nên client không có kênh nhận thông báo hay tin nhắn khi đang ở màn hình khác.
- `PUT /users/me` đang cho cập nhật `avatarUrl` tùy ý và không biết tới `username`.
- Chưa có endpoint tìm người dùng; `GET /users/me` là endpoint user duy nhất.

### 3.3 Quyết định chuyển đổi

- Một cặp user chỉ có tối đa một document quan hệ. Khóa duy nhất được dựng từ cặp `userA`/`userB` đã sắp xếp, không phụ thuộc ai gửi trước.
- Trạng thái quan hệ được đổi bằng compare-and-set trên một document (`findOneAndUpdate` kèm điều kiện `status` hiện tại), không dùng transaction nhiều document.
- Chặn người dùng là quan hệ một chiều, lưu ở collection riêng, và luôn được kiểm tra trước mọi hành động bạn bè.
- Presence là dữ liệu tạm, chỉ nằm trong Redis với TTL. MongoDB không lưu trạng thái online.
- Client kết nối một namespace socket duy nhất cho toàn bộ tính năng xã hội: `/social`. Namespace `/study-rooms` giữ nguyên trách nhiệm hiện tại.
- Notification và direct message là nguồn sự thật trong MongoDB; socket chỉ là kênh đẩy. Client luôn phải có đường REST để lấy lại dữ liệu sau khi mất kết nối.
- Hoạt động gần đây được ghi bằng event rời (`ActivityEvent`), không suy ra từ `StudyActivity`, vì `StudyActivity` chỉ giữ một document cho mỗi ngày và bị ghi đè.
- Tính năng bạn bè không được ghi vào bảng nào của phòng học ảo, và ngược lại.

## 4. Kiến trúc tối thiểu

```text
REST (đồng bộ, nguồn sự thật)
  Client
    |
    | GET/POST/PATCH/DELETE /api/v1/friends, /friends/requests,
    |   /blocks, /conversations, /notifications, /users/search
    v
  Express friend/block/conversation/notification controller
    v
  service layer
    |-- Friendship / UserBlock
    |-- Conversation / DirectMessage
    |-- Notification / ActivityEvent
    |-- User
    |        `------------> MongoDB
    `-- presence.service -> Redis (chỉ đọc trạng thái online)

Realtime (không đồng bộ, chỉ đẩy)
  Client --- socket namespace /social ---> socketAuth
    |
    |-- presence:heartbeat  -> Redis (TTL)
    |-- dm:send / dm:read   -> MongoDB + emit tới người nhận
    `-- nhận:
          notification:new
          friend:request-received / friend:request-accepted
          presence:changed
          dm:new / dm:read
```

Phân vai:

- **MongoDB** giữ quan hệ bạn bè, chặn, tin nhắn, notification và activity event.
- **Redis** giữ presence có TTL và các bộ đếm rate limit.
- **Express** xác thực, kiểm tra quan hệ và quyền, chốt phạm vi truy vấn.
- **Socket.IO `/social`** đẩy sự kiện tới đúng user, nhận heartbeat và tin nhắn.
- **Client** luôn có thể dựng lại toàn bộ trạng thái bằng REST; socket chỉ giúp cập nhật nhanh hơn.

## 5. Nguồn sự thật

| Dữ liệu                       | Nguồn sự thật                                 | Quy tắc                                                                    |
| ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Định danh `@handle`           | `User.username`                               | Unique, lowercase, không đổi quá `USERNAME_CHANGE_COOLDOWN_DAYS`           |
| Quan hệ bạn bè                | `Friendship` với `status = accepted`           | Một document cho mỗi cặp `{ userA, userB }`                                |
| Lời mời chờ xử lý             | `Friendship` với `status = pending`            | Hướng lấy từ `requesterId`/`addresseeId`                                   |
| Đã từ chối                    | `Friendship` với `status = declined`           | Giữ lại để áp cooldown gửi lại                                             |
| Chặn người dùng               | `UserBlock`                                   | Một chiều, `{ blockerId, blockedId }` unique                               |
| Trạng thái online             | Redis `social:v1:presence:<userId>`           | Không có key nghĩa là offline; MongoDB không lưu                           |
| Số bạn bè                     | `countDocuments` trên `Friendship`             | Không denormalize trong MVP                                                |
| Cuộc hội thoại 1-1            | `Conversation`                                 | Unique theo cặp `{ userA, userB }`                                         |
| Tin nhắn                      | `DirectMessage`                                 | Dedup theo `{ conversationId, senderId, clientMessageId }`                 |
| Số tin chưa đọc               | `ConversationMember.unreadCount`               | Tăng khi có tin mới, reset khi đánh dấu đã đọc                             |
| Thông báo                     | `Notification`                                  | `readAt = null` nghĩa là chưa đọc                                          |
| Hoạt động gần đây             | `ActivityEvent`                                 | Chỉ event có `visibility = friends` mới vào feed của bạn bè                 |
| Chuỗi ngày học                | `StudyActivity.dateKey`                        | Đã có sẵn; activity event chỉ tham chiếu, không tính lại                   |

### 5.1 Invariant về quan hệ

Mọi truy vấn phải thỏa:

```text
userA < userB                       // so sánh chuỗi hex của ObjectId
requesterId != addresseeId
{ requesterId, addresseeId } == { userA, userB }
không tồn tại hai document cùng { userA, userB }
status = accepted  =>  quan hệ đối xứng, cả hai đều thấy nhau là bạn
tồn tại UserBlock giữa hai user  =>  không tồn tại Friendship status accepted
```

Nếu dữ liệu cũ làm bất biến trên sai, service phải loại document lỗi khỏi response và log cảnh báo để dọn dữ liệu sau, không được trả quan hệ nửa vời cho client.

### 5.2 Empty state

User mới vẫn nhận `200 OK`:

- `GET /friends` trả `items = []`, `pagination.total = 0`;
- `GET /friends/requests` trả `incoming = []`, `outgoing = []`, `incomingTotal = 0`;
- `GET /friends/activities` trả `items = []`;
- `GET /conversations` trả `items = []`, `totalUnread = 0`;
- `GET /notifications` trả `items = []`, `unreadCount = 0`;
- `GET /blocks` trả `items = []`;
- `username` có thể là `null` nếu user chưa đặt;
- không ném `404` chỉ vì chưa có bạn bè hoặc chưa có lời mời.

## 6. Mô hình dữ liệu

### 6.1 `User` bổ sung

```js
username: {
  type: String,
  default: null,
  trim: true,
  lowercase: true,
  minlength: USER_LIMITS.USERNAME_MIN_LENGTH,
  maxlength: USER_LIMITS.USERNAME_MAX_LENGTH
},
usernameUpdatedAt: { type: Number, default: null },
activityVisibility: {
  type: String,
  enum: Object.values(ACTIVITY_VISIBILITY),
  default: ACTIVITY_VISIBILITY.FRIENDS
},
friendRequestPolicy: {
  type: String,
  enum: Object.values(FRIEND_REQUEST_POLICY),
  default: FRIEND_REQUEST_POLICY.EVERYONE
}
```

Index:

```js
userSchema.index({ username: 1 }, { unique: true, sparse: true })
userSchema.index({ displayName: 'text' })
```

Dùng `sparse` để nhiều user chưa đặt username không xung đột trên `null`. Không dùng `unique: true` trực tiếp trong định nghĩa field vì cần `sparse`.

Quy tắc `username`:

- chỉ chấp nhận `^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$`;
- không cho phép hai dấu chấm hoặc hai gạch dưới liền nhau;
- so sánh và lưu ở dạng lowercase; client hiển thị nguyên văn đã lưu;
- có danh sách từ khóa bị chặn (`admin`, `support`, `hitproduct`, `me`, `system`);
- lần đặt đầu tiên không tính cooldown; các lần sau cách nhau tối thiểu `USERNAME_CHANGE_COOLDOWN_DAYS`.

### 6.2 `Friendship`

```js
{
  userA: { type: ObjectId, ref: 'User', required: true },   // hex nhỏ hơn
  userB: { type: ObjectId, ref: 'User', required: true },   // hex lớn hơn
  requesterId: { type: ObjectId, ref: 'User', required: true },
  addresseeId: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], required: true },
  requestedAt: { type: Date, required: true },
  respondedAt: { type: Date, default: null }
}
```

Index:

```js
friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true })
friendshipSchema.index({ userA: 1, status: 1, respondedAt: -1 })
friendshipSchema.index({ userB: 1, status: 1, respondedAt: -1 })
friendshipSchema.index({ addresseeId: 1, status: 1, requestedAt: -1 })
friendshipSchema.index({ requesterId: 1, status: 1, requestedAt: -1 })
```

Hai index `userA`/`userB` phục vụ liệt kê bạn bè. Hai index `addresseeId`/`requesterId` phục vụ hộp thư lời mời đến và đã gửi.

Helper bắt buộc dùng ở mọi nơi:

```js
const toPairKey = (idA, idB) => {
  const [userA, userB] = [String(idA), String(idB)].sort()
  return { userA, userB }
}
```

Không tự viết lại logic sắp xếp trong service; luôn gọi helper để tránh lệch thứ tự giữa các nơi.

### 6.3 `UserBlock`

```js
{
  blockerId: { type: ObjectId, ref: 'User', required: true },
  blockedId: { type: ObjectId, ref: 'User', required: true }
}
```

Index:

```js
userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true })
userBlockSchema.index({ blockedId: 1 })
```

`timestamps: true` để biết thời điểm chặn. Chặn là một chiều: A chặn B không tạo bản ghi B chặn A, nhưng mọi truy vấn phải kiểm tra cả hai chiều.

### 6.4 `Conversation` và `ConversationMember`

```js
// Conversation
{
  userA: { type: ObjectId, ref: 'User', required: true },
  userB: { type: ObjectId, ref: 'User', required: true },
  lastMessageAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: null, maxlength: DM_LIMITS.PREVIEW_MAX },
  lastMessageSenderId: { type: ObjectId, ref: 'User', default: null }
}

// ConversationMember
{
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  userId: { type: ObjectId, ref: 'User', required: true },
  unreadCount: { type: Number, default: 0 },
  lastReadAt: { type: Date, default: null },
  lastReadMessageId: { type: ObjectId, ref: 'DirectMessage', default: null },
  mutedUntil: { type: Date, default: null }
}
```

Index:

```js
conversationSchema.index({ userA: 1, userB: 1 }, { unique: true })
conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true })
conversationMemberSchema.index({ userId: 1, unreadCount: -1 })
```

Tách `ConversationMember` để `unreadCount` và `lastReadAt` của hai người không ghi đè nhau, và để danh sách hội thoại của một user chỉ cần một truy vấn trên index `{ userId, ... }`. Danh sách hội thoại sắp xếp theo `Conversation.lastMessageAt`, nên thêm:

```js
conversationSchema.index({ userA: 1, lastMessageAt: -1 })
conversationSchema.index({ userB: 1, lastMessageAt: -1 })
```

### 6.5 `DirectMessage`

```js
{
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  senderId: { type: ObjectId, ref: 'User', required: true },
  clientMessageId: { type: String, trim: true, maxlength: 128, default: null },
  body: { type: String, required: true, trim: true, maxlength: DM_LIMITS.BODY_MAX },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: ObjectId, ref: 'User', default: null }
}
```

Index:

```js
directMessageSchema.index({ conversationId: 1, createdAt: -1 })
directMessageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  {
    name: 'direct_message_client_dedup',
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } }
  }
)
```

Đây đúng là mẫu đã dùng ở `roomMessage.model.js`; giữ nguyên để retry của client không tạo tin nhắn trùng.

### 6.6 `Notification`

```js
{
  userId: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
  actorId: { type: ObjectId, ref: 'User', default: null },
  refId: { type: ObjectId, default: null },
  readAt: { type: Date, default: null }
}
```

Index:

```js
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, readAt: 1 })
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS })
```

`NOTIFICATION_TYPE` cho MVP: `friend_request_received`, `friend_request_accepted`, `direct_message`. Notification không mang nội dung đã render; client tự dựng câu hiển thị từ `type` và `actor`. Nhờ vậy đổi wording không cần migration.

TTL 90 ngày để collection không phình vô hạn. Không đặt TTL trên notification chưa đọc nếu sản phẩm yêu cầu giữ lâu hơn; khi đó bỏ index TTL và thay bằng job dọn định kỳ.

### 6.7 `ActivityEvent`

```js
{
  userId: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(ACTIVITY_EVENT_TYPE), required: true },
  visibility: { type: String, enum: Object.values(ACTIVITY_VISIBILITY), required: true },
  occurredAt: { type: Date, required: true },
  payload: {
    deckId: { type: ObjectId, ref: 'Deck', default: null },
    deckTitle: { type: String, default: null },
    score: { type: Number, default: null },
    streakDays: { type: Number, default: null }
  }
}
```

Index:

```js
activityEventSchema.index({ userId: 1, occurredAt: -1 })
activityEventSchema.index({ visibility: 1, occurredAt: -1 })
activityEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: ACTIVITY_TTL_SECONDS })
```

`ACTIVITY_EVENT_TYPE` cho MVP, đúng theo các dòng trong thiết kế:

| Type              | Ý nghĩa                        | Nguồn phát sinh                     |
| ----------------- | ------------------------------ | ----------------------------------- |
| `quiz_completed`  | Hoàn thành một bài quiz        | Sau khi submit quiz thành công      |
| `quiz_high_score` | Đạt điểm cao trong một deck    | Submit quiz có `score >= 90`        |
| `learn_started`   | Bắt đầu học một deck mới       | Lần đầu có progress trong deck đó   |
| `streak_reached`  | Đạt chuỗi ngày học đáng kể     | Khi `currentDays` chạm mốc 7/30/100 |

`deckTitle` được snapshot tại thời điểm ghi event, để feed vẫn đọc được sau khi deck bị đổi tên hoặc xóa. Không `populate` deck khi trả feed.

Chỉ ghi event sau khi hành động học chính đã lưu thành công, giống nguyên tắc của `recordStudyActivity`. Lỗi ghi event không được làm fail request học tập; bọc trong try/catch và log.

### 6.8 Constant mới

```js
// src/constants/social.constant.js
const FRIENDSHIP_STATUS = { PENDING: 'pending', ACCEPTED: 'accepted', DECLINED: 'declined' }

const FRIEND_REQUEST_POLICY = { EVERYONE: 'everyone', NOBODY: 'nobody' }

const ACTIVITY_VISIBILITY = { FRIENDS: 'friends', PRIVATE: 'private' }

const ACTIVITY_EVENT_TYPE = {
  QUIZ_COMPLETED: 'quiz_completed',
  QUIZ_HIGH_SCORE: 'quiz_high_score',
  LEARN_STARTED: 'learn_started',
  STREAK_REACHED: 'streak_reached'
}

const NOTIFICATION_TYPE = {
  FRIEND_REQUEST_RECEIVED: 'friend_request_received',
  FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',
  DIRECT_MESSAGE: 'direct_message'
}

const PRESENCE_STATUS = { ONLINE: 'online', IDLE: 'idle', OFFLINE: 'offline' }

const FRIEND_LIMITS = {
  MAX_FRIENDS: 500,
  MAX_PENDING_OUTGOING: 50,
  MAX_BLOCKED: 500,
  REREQUEST_COOLDOWN_HOURS: 24,
  LIST_PAGE_SIZE: 20,
  LIST_PAGE_SIZE_MAX: 50,
  SEARCH_PAGE_SIZE: 20,
  SEARCH_QUERY_MIN: 2,
  SEARCH_QUERY_MAX: 60,
  ACTIVITY_PAGE_SIZE: 20,
  ACTIVITY_FEED_MAX_FRIENDS: 500,
  HIGH_SCORE_THRESHOLD: 90,
  STREAK_MILESTONES: [7, 30, 100]
}

const DM_LIMITS = {
  BODY_MAX: 2000,
  PREVIEW_MAX: 120,
  PAGE_SIZE: 30,
  PAGE_SIZE_MAX: 50,
  SEND_PER_10_SEC: 10
}

const NOTIFICATION_TTL_SECONDS = 60 * 60 * 24 * 90
const ACTIVITY_TTL_SECONDS = 60 * 60 * 24 * 90

const PRESENCE_LIMITS = {
  HEARTBEAT_SECONDS: 25,
  STALE_SECONDS: 75,
  IDLE_AFTER_SECONDS: 300
}

const SOCIAL_REDIS_KEY = {
  PRESENCE: (userId) => `social:v1:presence:${userId}`,
  RL_FRIEND_REQUEST: (userId) => `rl:friend-request:${userId}`,
  RL_SEARCH: (userId) => `rl:user-search:${userId}`,
  RL_DM: (userId) => `rl:dm:${userId}`
}
```

`USER_LIMITS` bổ sung:

```js
USERNAME_MIN_LENGTH: 3,
USERNAME_MAX_LENGTH: 30,
USERNAME_CHANGE_COOLDOWN_DAYS: 30
```

Nhớ export `social.constant.js` trong [src/constants/index.js](src/constants/index.js).

## 7. REST contract

Tất cả route dùng prefix `/api/v1` và cần:

```http
Authorization: Bearer <accessToken>
```

| Method   | Path                                | Trách nhiệm                                        |
| -------- | ----------------------------------- | -------------------------------------------------- |
| `GET`    | `/users/search`                     | Tìm người dùng theo username, displayName, email    |
| `GET`    | `/users/username-available`         | Kiểm tra username còn trống                        |
| `PUT`    | `/users/me/username`                | Đặt hoặc đổi username                              |
| `PUT`    | `/users/me/privacy`                 | Đổi `activityVisibility`, `friendRequestPolicy`     |
| `GET`    | `/users/:userId/profile`            | Hồ sơ công khai kèm quan hệ với user hiện tại       |
| `GET`    | `/friends`                          | Danh sách bạn bè, phân trang, kèm presence          |
| `GET`    | `/friends/summary`                  | Số bạn bè, số lời mời chờ, số tin chưa đọc          |
| `DELETE` | `/friends/:userId`                  | Hủy kết bạn                                        |
| `GET`    | `/friends/requests`                 | Lời mời đến và lời mời đã gửi                       |
| `POST`   | `/friends/requests`                 | Gửi lời mời kết bạn                                |
| `POST`   | `/friends/requests/:id/accept`      | Chấp nhận lời mời đến                              |
| `POST`   | `/friends/requests/:id/decline`     | Từ chối lời mời đến                                |
| `DELETE` | `/friends/requests/:id`             | Hủy lời mời đã gửi                                 |
| `GET`    | `/friends/activities`               | Feed hoạt động gần đây của bạn bè                   |
| `GET`    | `/blocks`                           | Danh sách đã chặn                                  |
| `POST`   | `/blocks`                           | Chặn một người dùng                                |
| `DELETE` | `/blocks/:userId`                   | Bỏ chặn                                           |
| `GET`    | `/conversations`                    | Danh sách hội thoại kèm tin cuối và unread          |
| `POST`   | `/conversations`                    | Mở hoặc lấy hội thoại với một người bạn             |
| `GET`    | `/conversations/:id/messages`       | Lịch sử tin nhắn, phân trang theo cursor            |
| `POST`   | `/conversations/:id/messages`       | Gửi tin nhắn (fallback khi socket không dùng được)   |
| `POST`   | `/conversations/:id/read`           | Đánh dấu đã đọc tới một tin nhắn                    |
| `GET`    | `/notifications`                    | Danh sách thông báo và số chưa đọc                  |
| `POST`   | `/notifications/read`               | Đánh dấu đã đọc theo id hoặc toàn bộ                |

`PUT /users/me` không được nhận `username`, `activityVisibility` hay `friendRequestPolicy`. Ba field này có route riêng vì có ràng buộc và cooldown khác nhau.

### 7.1 Shape user tóm tắt

Mọi endpoint bạn bè trả user theo đúng shape này. Không trả nguyên Mongoose document, `email`, `passwordHash`, `__v` hay `defaultQuizSize`.

```json
{
  "id": "66a...",
  "username": "huy.tran",
  "displayName": "Trần Đức Huy",
  "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/hitproduct/users/66a/avatar.webp",
  "presence": {
    "status": "online",
    "lastSeenAt": "2026-08-04T09:12:00.000Z"
  }
}
```

`presence.status` là một trong `online`, `idle`, `offline`. `presence.lastSeenAt` là `null` khi không có dữ liệu presence trong Redis. Chỉ đính kèm `presence` cho bạn bè đã accepted; kết quả tìm kiếm và lời mời không trả presence để không tiết lộ trạng thái của người chưa là bạn.

### 7.2 `GET /friends`

Query: `page` (mặc định `1`), `limit` (mặc định `20`, tối đa `50`), `q` (tùy chọn, lọc theo username hoặc displayName), `status` (tùy chọn: `online` để chỉ lấy bạn đang online).

```json
{
  "statusCode": 200,
  "message": "Lay danh sach ban be thanh cong.",
  "data": {
    "items": [
      {
        "id": "66a...",
        "username": "huy.tran",
        "displayName": "Trần Đức Huy",
        "avatarUrl": null,
        "presence": { "status": "online", "lastSeenAt": "2026-08-04T09:12:00.000Z" },
        "friendSince": "2026-07-20T10:00:00.000Z",
        "conversationId": "77b..."
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 6 }
  }
}
```

`conversationId` là `null` nếu hai người chưa từng nhắn tin. Client dùng giá trị này để mở thẳng hội thoại; nếu `null` thì gọi `POST /conversations`.

Sắp xếp mặc định: bạn đang online trước, sau đó theo `displayName` tăng dần. Vì presence nằm ngoài MongoDB, thứ tự online chỉ được áp trong phạm vi trang hiện tại; không được phân trang theo presence. Nếu client cần đúng thứ tự online trên toàn bộ danh sách, dùng `status=online` để lấy riêng nhóm online.

### 7.3 `GET /friends/summary`

```json
{
  "statusCode": 200,
  "message": "Lay tong quan ban be thanh cong.",
  "data": {
    "friendCount": 6,
    "onlineFriendCount": 2,
    "incomingRequestCount": 2,
    "outgoingRequestCount": 1,
    "unreadMessageCount": 3,
    "unreadNotificationCount": 4
  }
}
```

Endpoint này phục vụ badge trên sidebar và chuông thông báo. Giữ nó rẻ: chỉ `countDocuments` trên index và một lệnh Redis pipeline cho presence.

### 7.4 `GET /friends/requests`

Query: `direction` (`incoming`, `outgoing`, `all`; mặc định `all`), `page`, `limit`.

```json
{
  "statusCode": 200,
  "message": "Lay danh sach loi moi thanh cong.",
  "data": {
    "incoming": [
      {
        "requestId": "88c...",
        "user": { "id": "66b...", "username": "khoa.bui", "displayName": "Bùi Anh Khoa", "avatarUrl": null },
        "requestedAt": "2026-08-03T08:00:00.000Z"
      }
    ],
    "outgoing": [
      {
        "requestId": "88d...",
        "user": { "id": "66c...", "username": "vy.nguyen", "displayName": "Nguyễn Thảo Vy", "avatarUrl": null },
        "requestedAt": "2026-08-02T08:00:00.000Z"
      }
    ],
    "incomingTotal": 2,
    "outgoingTotal": 1
  }
}
```

`requestId` là `_id` của document `Friendship`. Client dùng nó cho accept, decline và cancel. Không cho client tự dựng id từ cặp user.

### 7.5 `POST /friends/requests`

```json
{ "userId": "66b..." }
```

hoặc

```json
{ "username": "khoa.bui" }
```

Đúng một trong hai field, dùng `Joi.object().xor('userId', 'username')`.

Response khi tạo lời mời mới:

```json
{
  "statusCode": 201,
  "message": "Da gui loi moi ket ban.",
  "data": {
    "requestId": "88c...",
    "status": "pending",
    "user": { "id": "66b...", "username": "khoa.bui", "displayName": "Bùi Anh Khoa", "avatarUrl": null }
  }
}
```

Response khi hai bên gửi chéo nhau và hệ thống tự kết bạn:

```json
{
  "statusCode": 200,
  "message": "Hai ban da tro thanh ban be.",
  "data": {
    "requestId": "88c...",
    "status": "accepted",
    "user": { "id": "66b...", "username": "khoa.bui", "displayName": "Bùi Anh Khoa", "avatarUrl": null }
  }
}
```

### 7.6 `GET /friends/activities`

Query: `page`, `limit` (mặc định `20`, tối đa `50`).

```json
{
  "statusCode": 200,
  "message": "Lay hoat dong gan day thanh cong.",
  "data": {
    "items": [
      {
        "id": "99e...",
        "type": "quiz_completed",
        "occurredAt": "2026-08-04T07:00:00.000Z",
        "user": { "id": "66a...", "username": "huy.tran", "displayName": "Trần Đức Huy", "avatarUrl": null },
        "payload": { "deckId": "66d...", "deckTitle": "Từ vựng tiếng Anh C1", "score": null, "streakDays": null }
      },
      {
        "id": "99f...",
        "type": "streak_reached",
        "occurredAt": "2026-08-02T07:00:00.000Z",
        "user": { "id": "66c...", "username": "vy.nguyen", "displayName": "Nguyễn Thảo Vy", "avatarUrl": null },
        "payload": { "deckId": null, "deckTitle": null, "score": null, "streakDays": 7 }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 24 }
  }
}
```

Backend trả dữ liệu thô; client chịu trách nhiệm dựng câu hiển thị theo `type`. Không trả chuỗi tiếng Việt đã render từ backend, để đổi wording không cần phát hành lại API.

Feed chỉ chứa event của bạn bè đã accepted, có `visibility = friends`, và người phát không nằm trong quan hệ chặn hai chiều với user hiện tại. Không đưa event của chính user vào feed bạn bè.

### 7.7 `GET /users/search`

Query: `q` (bắt buộc, `2` đến `60` ký tự), `page`, `limit`.

```json
{
  "statusCode": 200,
  "message": "Tim kiem nguoi dung thanh cong.",
  "data": {
    "items": [
      {
        "id": "66b...",
        "username": "khoa.bui",
        "displayName": "Bùi Anh Khoa",
        "avatarUrl": null,
        "relationship": { "state": "incoming_request", "requestId": "88c..." }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1 }
  }
}
```

`relationship.state` là một trong:

| State              | Ý nghĩa                                | Hành động khả dụng ở client |
| ------------------ | -------------------------------------- | --------------------------- |
| `none`             | Chưa có quan hệ                        | Gửi lời mời                 |
| `pending_outgoing` | Đã gửi lời mời, đang chờ               | Hủy lời mời                 |
| `incoming_request` | Có lời mời đến từ người này            | Chấp nhận hoặc từ chối      |
| `friends`          | Đã là bạn bè                           | Nhắn tin, hủy kết bạn       |
| `blocked`          | User hiện tại đã chặn người này        | Bỏ chặn                     |
| `self`             | Chính user hiện tại                    | Không có                    |

Quy tắc tìm kiếm:

- khớp `username` chính xác hoặc theo prefix;
- khớp `displayName` không phân biệt hoa thường theo prefix của từ;
- khớp email chỉ khi `q` là một email đầy đủ và khớp tuyệt đối, để không dò được email theo từng ký tự;
- không bao giờ trả email trong response;
- loại chính user hiện tại;
- loại người user hiện tại đã chặn và người đã chặn user hiện tại;
- có rate limit riêng.

Không dùng regex không neo đầu (`/.*q.*/`) trên `displayName` với dữ liệu lớn vì không dùng được index. Với MVP, dùng regex neo prefix `^` kèm `collation` không phân biệt hoa thường, hoặc text index nếu cần tìm giữa chuỗi.

### 7.8 `GET /conversations`

```json
{
  "statusCode": 200,
  "message": "Lay danh sach hoi thoai thanh cong.",
  "data": {
    "items": [
      {
        "id": "77b...",
        "partner": {
          "id": "66a...",
          "username": "huy.tran",
          "displayName": "Trần Đức Huy",
          "avatarUrl": null,
          "presence": { "status": "online", "lastSeenAt": "2026-08-04T09:12:00.000Z" }
        },
        "lastMessage": {
          "preview": "Mai on tap cung nhau nhe",
          "senderId": "66a...",
          "sentAt": "2026-08-04T09:10:00.000Z"
        },
        "unreadCount": 2,
        "isFriend": true
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3 },
    "totalUnread": 3
  }
}
```

`isFriend = false` khi hai người từng là bạn và đã hủy kết bạn: lịch sử vẫn đọc được nhưng không gửi được tin mới. Nếu một bên đã chặn, hội thoại bị ẩn khỏi danh sách của người chặn.

### 7.9 `GET /conversations/:id/messages`

Query: `before` (cursor là `_id` của tin nhắn, tùy chọn), `limit` (mặc định `30`, tối đa `50`).

Dùng cursor thay vì `page` vì tin nhắn được chèn liên tục, `skip` sẽ trả trùng hoặc thiếu.

```json
{
  "statusCode": 200,
  "message": "Lay tin nhan thanh cong.",
  "data": {
    "items": [
      {
        "id": "aa1...",
        "senderId": "66a...",
        "body": "Mai on tap cung nhau nhe",
        "clientMessageId": null,
        "createdAt": "2026-08-04T09:10:00.000Z",
        "deletedAt": null
      }
    ],
    "nextCursor": "aa0...",
    "hasMore": true
  }
}
```

Trả tin mới nhất trước (`createdAt` giảm) để client render từ dưới lên. `nextCursor` là `null` khi `hasMore = false`. Tin đã xóa vẫn trả nhưng `body` là chuỗi rỗng và `deletedAt` khác `null`.

### 7.10 `GET /notifications`

Query: `page`, `limit`, `unreadOnly` (boolean).

```json
{
  "statusCode": 200,
  "message": "Lay thong bao thanh cong.",
  "data": {
    "items": [
      {
        "id": "bb1...",
        "type": "friend_request_received",
        "actor": { "id": "66b...", "username": "khoa.bui", "displayName": "Bùi Anh Khoa", "avatarUrl": null },
        "refId": "88c...",
        "readAt": null,
        "createdAt": "2026-08-03T08:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 4 },
    "unreadCount": 4
  }
}
```

`POST /notifications/read` nhận `{ "ids": ["bb1..."] }` hoặc `{ "all": true }`, dùng `xor`. Response trả `unreadCount` mới.

### 7.11 Mã lỗi

| Tình huống                                        | Status | Ghi chú                                                       |
| ------------------------------------------------- | ------ | ------------------------------------------------------------- |
| Không có access token                             | `401`  | Do `authMiddleware` xử lý                                     |
| Payload sai schema                                | `400`  | Do `validateMiddleware` xử lý                                 |
| Tự gửi lời mời cho chính mình                     | `400`  | Kiểm tra trước mọi truy vấn                                   |
| Username sai định dạng hoặc thuộc danh sách chặn  | `400`  |                                                               |
| Đổi username khi chưa hết cooldown                | `409`  | Kèm thời điểm được đổi lần sau                                |
| Username đã có người dùng                         | `409`  | Bắt cả lỗi `E11000` từ unique index                           |
| Người nhận không tồn tại, đã chặn, hoặc bị chặn   | `404`  | Dùng chung một thông điệp, không tiết lộ lý do                |
| Người nhận đặt `friendRequestPolicy = nobody`     | `403`  |                                                               |
| Đã là bạn bè                                      | `409`  |                                                               |
| Đã có lời mời đang chờ theo cùng hướng            | `409`  |                                                               |
| Gửi lại lời mời khi chưa hết cooldown sau decline | `429`  | Kèm `retryAfterSeconds`                                       |
| Vượt `MAX_FRIENDS` hoặc `MAX_PENDING_OUTGOING`    | `409`  |                                                               |
| Accept/decline lời mời không thuộc về mình        | `404`  | Không trả `403` để không tiết lộ sự tồn tại của lời mời        |
| Accept lời mời đã được xử lý                      | `409`  | Kết quả của compare-and-set thất bại                          |
| Hủy kết bạn với người không phải bạn              | `404`  |                                                               |
| Gửi tin cho người không còn là bạn hoặc đã chặn   | `403`  |                                                               |
| Đọc hội thoại mình không tham gia                 | `404`  |                                                               |
| Vượt rate limit                                   | `429`  | Do `rateLimitMiddleware` xử lý                                |

Toàn bộ lỗi đi qua `ApiError` và error middleware hiện có; không tự `res.json` trong service.

## 8. State machine quan hệ

```text
                 POST /friends/requests
  (không có doc) ----------------------> pending (requester=A, addressee=B)
                                            |
             POST /friends/requests/:id/accept (chỉ B)
                                            v
                                        accepted
                                            |
             DELETE /friends/:userId (A hoặc B) hoặc POST /blocks
                                            v
                                    (xóa document)

  pending --- POST /friends/requests/:id/decline (chỉ B) ---> declined
  pending --- DELETE /friends/requests/:id (chỉ A) ---------> (xóa document)
  declined -- POST /friends/requests sau cooldown ----------> pending
```

Quy tắc bắt buộc:

1. **Gửi lời mời** khi đã có document:
   - `status = pending` và `requesterId` là user hiện tại: trả `409`, không tạo thêm.
   - `status = pending` và `addresseeId` là user hiện tại: tự động accept, trả `200` với `status = accepted`. Đây là trường hợp hai người gửi chéo nhau.
   - `status = accepted`: trả `409`.
   - `status = declined` và chưa hết `REREQUEST_COOLDOWN_HOURS` tính từ `respondedAt`: trả `429`.
   - `status = declined` và đã hết cooldown: cập nhật cùng document về `pending` với `requesterId`/`addresseeId` mới và `requestedAt` mới.

2. **Chống race khi gửi đồng thời**: luôn dùng `findOneAndUpdate` với filter theo `{ userA, userB }` và `upsert: true`. Nếu nhận `E11000`, đọc lại document rồi áp lại quy tắc trên đúng một lần. Không dùng `findOne` rồi `create`, vì hai request song song sẽ tạo hai document.

3. **Accept** phải là compare-and-set trên một document:

```js
const friendship = await friendshipModel.findOneAndUpdate(
  { _id: requestId, addresseeId: userId, status: FRIENDSHIP_STATUS.PENDING },
  { $set: { status: FRIENDSHIP_STATUS.ACCEPTED, respondedAt: new Date() } },
  { new: true }
)
```

`null` nghĩa là lời mời không tồn tại, không thuộc về user, hoặc đã được xử lý. Phân biệt hai trường hợp bằng một truy vấn `findById` chỉ để chọn `404` hay `409`.

4. **Chặn người dùng** là hành động tổng hợp, thực hiện theo thứ tự:

```text
tạo UserBlock (upsert, idempotent)
  -> xóa document Friendship của cặp này nếu có
  -> xóa notification liên quan tới cặp này chưa đọc
  -> emit friend:removed cho người bị chặn nếu trước đó là bạn
```

Nếu bước sau lỗi, `UserBlock` vẫn tồn tại và người chặn vẫn được bảo vệ. Chọn thứ tự này vì hệ quả của lỗi giữa luồng là an toàn hơn: thà còn quan hệ rác trong DB còn hơn đã xóa quan hệ mà chặn chưa có hiệu lực. Cung cấp job dọn định kỳ tìm `Friendship` tồn tại đồng thời với `UserBlock` để xóa nốt.

5. **Bỏ chặn** chỉ xóa `UserBlock`. Không tự phục hồi quan hệ bạn bè cũ. Muốn kết bạn lại phải gửi lời mời mới.

6. **Kiểm tra chặn** là bước đầu tiên của mọi service bạn bè, lời mời, feed và tin nhắn:

```js
const isBlockedEitherWay = await userBlockModel.exists({
  $or: [
    { blockerId: userId, blockedId: targetId },
    { blockerId: targetId, blockedId: userId }
  ]
})
```

Với danh sách, không gọi hàm này trong vòng lặp. Lấy một lần toàn bộ id liên quan tới chặn của user hiện tại rồi lọc bằng `Set`.

## 9. Presence

### 9.1 Cấu trúc Redis

Một user có thể mở nhiều tab và nhiều thiết bị, nên presence phải đếm được nhiều kết nối:

```text
key:   social:v1:presence:<userId>       (Hash)
field: <socketId>
value: JSON { deviceId, status, lastSeenAt }
TTL:   PRESENCE_LIMITS.STALE_SECONDS trên toàn key, refresh mỗi heartbeat
```

Chọn Hash thay vì một key đơn để đóng một tab không làm user thành offline khi tab khác còn mở. Đây cũng là hướng mà presence phòng học đã đi (`ROOM_REDIS_KEY.PRESENCE` dùng Hash).

Quy tắc suy ra trạng thái:

```text
không có key hoặc hash rỗng            -> offline
có ít nhất một field status = online   -> online
tất cả field đều status = idle         -> idle
```

`lastSeenAt` trả về là giá trị lớn nhất trong các field.

### 9.2 Vòng đời

```text
1. Client connect namespace /social với { token, deviceId }.
2. socketAuthMiddleware xác thực token và session, gắn socket.user.
3. Server HSET presence field socketId, EXPIRE key STALE_SECONDS.
4. Server join socket vào room riêng: user:<userId>.
5. Client emit presence:heartbeat mỗi HEARTBEAT_SECONDS, kèm status online hoặc idle.
6. Mỗi heartbeat cập nhật field và refresh TTL của key.
7. Khi disconnect, server HDEL field đó. Nếu hash rỗng thì DEL key.
8. Nếu tiến trình chết mà không kịp HDEL, TTL sẽ tự dọn sau STALE_SECONDS.
```

`HEARTBEAT_SECONDS = 25` và `STALE_SECONDS = 75` cho phép mất hai heartbeat liên tiếp mà chưa bị coi là offline, giống thông số đã dùng cho phòng học.

Client tự quyết định `idle`: không có tương tác chuột hoặc bàn phím trong `IDLE_AFTER_SECONDS`. Server không tự suy ra idle, vì server không biết tab có đang được nhìn hay không.

### 9.3 Phát tán thay đổi

Khi một user chuyển giữa offline và online, hoặc giữa online và idle, server emit tới bạn bè:

```text
nsp.to(bạn bè).emit('presence:changed', { userId, status, lastSeenAt })
```

Để làm được việc này rẻ, khi socket connect thì lấy danh sách id bạn bè một lần và emit tới các room `user:<friendId>`. Không emit ở mỗi heartbeat; chỉ emit khi trạng thái tổng hợp thực sự đổi.

Nếu số bạn bè vượt `ACTIVITY_FEED_MAX_FRIENDS`, bỏ qua bước fan-out và để client tự poll `GET /friends?status=online`. Ghi log rõ khi bỏ qua, không im lặng.

### 9.4 Đọc presence trong REST

`presence.service.js` cung cấp:

```js
getPresenceMap(userIds)   // trả Map<userId, { status, lastSeenAt }> bằng một Redis pipeline
countOnline(userIds)      // dùng cho friends/summary
```

Không gọi Redis trong vòng lặp. Với một trang 20 bạn bè, đúng một pipeline gồm 20 lệnh `HGETALL`. Nếu Redis lỗi, trả `status = offline` cho toàn bộ và log cảnh báo; lỗi presence không được làm fail `GET /friends`.

## 10. Realtime namespace `/social`

Thêm namespace mới trong [src/sockets/index.js](src/sockets/index.js), dùng lại `socketAuthMiddleware`:

```js
const socialNsp = io.of('/social')
socialNsp.use(socketAuthMiddleware)
socialNsp.on('connection', (socket) => {
  registerPresenceHandlers(socialNsp, socket)
  registerDirectMessageHandlers(socialNsp, socket)
})
```

Mỗi socket join room `user:<userId>` để mọi nơi trong backend có thể đẩy sự kiện tới một user mà không cần biết socket id.

### 10.1 Sự kiện client gửi lên

| Event                | Payload                                              | Ghi chú                                             |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `presence:heartbeat` | `{ status: 'online' \| 'idle' }`                     | Mỗi 25 giây                                         |
| `dm:send`            | `{ conversationId, body, clientMessageId }`          | `clientMessageId` là UUID v4 do client sinh         |
| `dm:read`            | `{ conversationId, lastReadMessageId }`              | Đánh dấu đã đọc                                     |
| `dm:typing`          | `{ conversationId, isTyping }`                       | Không lưu DB, chỉ chuyển tiếp                       |

Toàn bộ handler bọc trong `safeHandler` và validate bằng Joi trong `social.contract.js`, đúng như `chat.handler.js` đang làm. Payload sai trả `INVALID_PAYLOAD` qua ack, không throw ra ngoài.

### 10.2 Sự kiện server đẩy xuống

| Event                     | Payload                                                  | Khi nào                          |
| ------------------------- | -------------------------------------------------------- | -------------------------------- |
| `friend:request-received` | `{ requestId, user }`                                    | Có lời mời mới đến               |
| `friend:request-accepted` | `{ requestId, user, conversationId }`                    | Lời mời của mình được chấp nhận  |
| `friend:removed`          | `{ userId }`                                             | Bị hủy kết bạn hoặc bị chặn      |
| `presence:changed`        | `{ userId, status, lastSeenAt }`                          | Trạng thái bạn bè đổi            |
| `notification:new`        | `{ notification, unreadCount }`                           | Có notification mới              |
| `dm:new`                  | `{ conversationId, message, unreadCount }`                | Có tin nhắn mới                  |
| `dm:read`                 | `{ conversationId, userId, lastReadMessageId, readAt }`   | Đối phương đã đọc                |
| `dm:typing`               | `{ conversationId, userId, isTyping }`                    | Đối phương đang nhập             |

Nguyên tắc: mọi sự kiện đẩy xuống đều phải có một endpoint REST tương ứng để client lấy lại cùng dữ liệu. Socket là kênh tăng tốc, không phải nguồn sự thật. Client mất mạng rồi vào lại phải gọi `GET /friends/summary` và các danh sách liên quan để đồng bộ.

### 10.3 Giới hạn

- `maxHttpBufferSize` hiện tại là `1e4` byte, đủ cho `DM_LIMITS.BODY_MAX = 2000` ký tự. Nếu tăng `BODY_MAX`, phải xem lại giới hạn này.
- Rate limit `dm:send` bằng Redis: `DM_LIMITS.SEND_PER_10_SEC` theo mẫu `CHAT_RL` trong `chat.handler.js`.
- Nếu chạy nhiều instance API, bắt buộc bật Redis adapter cho Socket.IO (đoạn code đang bị comment trong `sockets/index.js`). Không bật thì `user:<userId>` chỉ tồn tại trên một instance và sự kiện sẽ mất.

## 11. Luồng nhắn tin

### 11.1 Mở hội thoại

```text
POST /conversations { userId }
  -> kiểm tra chặn hai chiều
  -> kiểm tra quan hệ accepted
  -> toPairKey(me, target)
  -> findOneAndUpdate({ userA, userB }, { $setOnInsert: ... }, { upsert: true, new: true })
  -> upsert hai ConversationMember
  -> trả { conversationId }
```

Dùng upsert kèm unique index thay vì transaction, để không phụ thuộc replica set. Nếu `ConversationMember` thứ hai chưa được tạo do lỗi, service đọc hội thoại phải tự upsert lại member còn thiếu thay vì trả `404`.

### 11.2 Gửi tin

```text
dm:send hoặc POST /conversations/:id/messages
  -> validate body và clientMessageId
  -> kiểm tra socket.user là thành viên hội thoại
  -> kiểm tra chặn hai chiều và quan hệ vẫn accepted
  -> rate limit theo user
  -> create DirectMessage
       nếu E11000 trên direct_message_client_dedup:
         đọc lại tin đã tồn tại và trả về, coi như thành công
  -> cập nhật Conversation.lastMessageAt, lastMessagePreview, lastMessageSenderId
  -> $inc unreadCount của ConversationMember phía người nhận
  -> emit dm:new tới user:<receiverId>
  -> ghi Notification type direct_message nếu người nhận không online
       và không có notification direct_message chưa đọc nào cho hội thoại này
```

Xử lý `E11000` như thành công là điều kiện để client retry an toàn khi mạng chập chờn. Không tạo notification cho từng tin nhắn, nếu không chuông sẽ bị spam; một hội thoại chỉ có tối đa một notification `direct_message` chưa đọc.

`lastMessagePreview` là `body` đã cắt còn `PREVIEW_MAX` ký tự. Cắt theo ký tự Unicode, không theo byte.

### 11.3 Đánh dấu đã đọc

```text
dm:read hoặc POST /conversations/:id/read { lastReadMessageId }
  -> xác nhận tin nhắn thuộc hội thoại
  -> set unreadCount = 0, lastReadAt = now, lastReadMessageId
  -> đánh dấu đã đọc các Notification direct_message của hội thoại này
  -> emit dm:read tới đối phương
```

Không cho `lastReadMessageId` lùi về quá khứ làm `unreadCount` sai; chỉ cập nhật khi tin mới hơn `lastReadMessageId` hiện tại.

### 11.4 Sau khi hủy kết bạn hoặc chặn

- Hội thoại và tin nhắn cũ được giữ lại.
- Gửi tin mới trả `403`.
- Người chặn không thấy hội thoại trong `GET /conversations`.
- Người bị chặn vẫn thấy hội thoại nhưng không gửi được tin; response `403` dùng thông điệp trung tính, không nói rõ là bị chặn.

Đây là lựa chọn có chủ ý: xóa lịch sử khi hủy kết bạn sẽ mất dữ liệu người dùng có thể vẫn cần, và không giúp gì cho quyền riêng tư vì đối phương đã đọc tin từ trước.

## 12. Hoạt động gần đây

### 12.1 Điểm ghi event

| Nơi gọi                                          | Event                                | Điều kiện                                        |
| ------------------------------------------------ | ------------------------------------ | ------------------------------------------------ |
| `quiz.service.js` sau khi submit thành công      | `quiz_completed`                     | Luôn ghi                                         |
| `quiz.service.js` sau khi submit thành công      | `quiz_high_score`                    | `score >= HIGH_SCORE_THRESHOLD`                  |
| `learn.service.js` hoặc `study.service.js`       | `learn_started`                      | Lần đầu user có progress trong deck đó           |
| `studyActivity.service.js` sau `recordStudyActivity` | `streak_reached`                 | `currentDays` vừa chạm mốc trong `STREAK_MILESTONES` |

`visibility` được lấy từ `User.activityVisibility` tại thời điểm ghi và đóng băng trong document. Đổi cài đặt về `private` không sửa lại event cũ; thay vào đó service feed phải loại bỏ event của user đang đặt `private`. Cách này giữ được ý định của user tại thời điểm ghi và vẫn tôn trọng cài đặt hiện tại.

Việc ghi event không được nằm trong cùng đường dữ liệu thành công của hành động học:

```js
try {
  await activityEventService.record({ userId, type, payload, occurredAt })
} catch (error) {
  logger.warn(`Ghi activity event that bai: ${error.message}`)
}
```

### 12.2 Truy vấn feed

```text
1. Lấy danh sách id bạn bè accepted (giới hạn ACTIVITY_FEED_MAX_FRIENDS).
2. Lấy tập id bị chặn hai chiều và loại khỏi danh sách trên.
3. Lấy tập id bạn bè đang đặt activityVisibility = private và loại tiếp.
4. find({ userId: { $in: friendIds }, visibility: 'friends' })
     .sort({ occurredAt: -1 })
     .skip(...).limit(...)
5. Populate user tối thiểu: username, displayName, avatarUrl.
```

Bước 3 cần một truy vấn `User.find({ _id: { $in: friendIds }, activityVisibility: 'private' }).select('_id')`. Với vài trăm bạn bè, chi phí này không đáng kể và tránh phải sửa dữ liệu cũ.

Index `{ userId: 1, occurredAt: -1 }` phục vụ được `$in` kèm sort. Khi số bạn bè lớn, `skip` sâu sẽ chậm; chuyển sang cursor theo `occurredAt` khi có số đo chứng minh cần thiết. Nếu `friendIds` rỗng, trả thẳng empty state, không chạy truy vấn.

## 13. File map backend

| File                                                     | Trách nhiệm                                              |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `src/constants/social.constant.js`                       | Enum, limit, Redis key của toàn bộ tính năng             |
| `src/constants/user.constant.js`                         | Bổ sung giới hạn username                                |
| `src/constants/index.js`                                 | Export constant mới                                      |
| `src/models/user.model.js`                               | `username`, privacy, index                               |
| `src/models/friendship.model.js`                         | Quan hệ bạn bè và lời mời                                |
| `src/models/userBlock.model.js`                          | Chặn người dùng                                          |
| `src/models/conversation.model.js`                       | Hội thoại 1-1                                            |
| `src/models/conversationMember.model.js`                 | Unread và lastRead theo từng phía                        |
| `src/models/directMessage.model.js`                      | Tin nhắn 1-1                                             |
| `src/models/notification.model.js`                       | Thông báo in-app                                         |
| `src/models/activityEvent.model.js`                      | Event hoạt động học tập                                  |
| `src/models/index.js`                                    | Export model mới                                         |
| `src/utils/pairKey.js`                                   | `toPairKey` dùng chung                                   |
| `src/validations/client/friend.validation.js`            | Query và body của friends, requests, blocks              |
| `src/validations/client/conversation.validation.js`      | Query và body của conversations, messages                |
| `src/validations/client/notification.validation.js`      | Query và body của notifications                          |
| `src/validations/client/user.validation.js`              | `search`, `username`, `privacy`; bỏ `avatarUrl` khỏi `updateProfile` |
| `src/services/client/friend.service.js`                  | State machine quan hệ, danh sách, summary                |
| `src/services/client/block.service.js`                   | Chặn, bỏ chặn, helper kiểm tra chặn                      |
| `src/services/client/conversation.service.js`            | Mở hội thoại, danh sách, gửi và đọc tin                  |
| `src/services/client/notification.service.js`            | Tạo, liệt kê, đánh dấu đã đọc                            |
| `src/services/client/activityEvent.service.js`           | Ghi event và dựng feed                                   |
| `src/services/client/presence.service.js`                | Đọc và ghi presence trên Redis                           |
| `src/services/client/user.service.js`                    | Tìm người dùng, đặt username, privacy                    |
| `src/controllers/client/friend.controller.js`            | REST adapter friends và requests                         |
| `src/controllers/client/block.controller.js`             | REST adapter blocks                                      |
| `src/controllers/client/conversation.controller.js`      | REST adapter conversations                               |
| `src/controllers/client/notification.controller.js`      | REST adapter notifications                               |
| `src/routers/client/friend.route.js`                     | `/friends`, `/friends/requests`, `/friends/activities`   |
| `src/routers/client/block.route.js`                      | `/blocks`                                                |
| `src/routers/client/conversation.route.js`               | `/conversations`                                         |
| `src/routers/client/notification.route.js`               | `/notifications`                                         |
| `src/routers/client/user.route.js`                       | `/users/search`, `/users/me/username`, `/users/me/privacy`, `/users/:userId/profile` |
| `src/routers/client/index.js`                            | Mount router mới                                         |
| `src/sockets/index.js`                                   | Namespace `/social`                                      |
| `src/sockets/contracts/social.contract.js`               | Tên event và Joi schema                                  |
| `src/sockets/handlers/presence.handler.js`               | Heartbeat, connect, disconnect                           |
| `src/sockets/handlers/directMessage.handler.js`          | `dm:send`, `dm:read`, `dm:typing`                        |
| `src/sockets/services/socialRealtime.service.js`         | Hàm `emitToUser` dùng chung cho service REST             |
| `src/services/client/quiz.service.js`                    | Gọi ghi activity event                                   |
| `src/services/client/study.service.js`                   | Gọi ghi `learn_started`                                  |
| `src/services/client/studyActivity.service.js`            | Trả mốc streak vừa đạt để ghi event                      |
| `src/services/client/dashboard.service.js`               | Tùy chọn: thêm `friendCount` vào tổng quan               |
| `swagger/swagger.json`                                   | Bổ sung toàn bộ endpoint mới                             |
| `postman/HIT-Product.collection.json`                    | Bổ sung request mẫu                                      |

Khi tạo file mới, cập nhật các barrel `index.js` tương ứng: `src/models/index.js`, `src/services/client/index.js`, `src/controllers/client/index.js`, `src/validations/client/index.js`, `src/constants/index.js`.

Điểm cần lưu ý về thứ tự route: `/users/search`, `/users/username-available` và `/users/me/*` phải được khai báo trước `/users/:userId/profile`, nếu không Express sẽ khớp `search` vào `:userId`.

## 14. Kế hoạch triển khai theo phase

### Phase 1 - Định danh và tìm bạn

Mục tiêu: có `@handle` để mọi tính năng sau tham chiếu.

1. Thêm `username`, `usernameUpdatedAt`, `activityVisibility`, `friendRequestPolicy` vào `User`.
2. Thêm unique sparse index cho `username`.
3. Viết script backfill: sinh username từ phần trước `@` của email, chuẩn hóa ký tự lạ, thêm hậu tố số khi trùng. Script phải chạy lại được nhiều lần mà không đổi kết quả.
4. Thêm `PUT /users/me/username` với validate, blacklist và cooldown.
5. Thêm `GET /users/username-available`.
6. Thêm `PUT /users/me/privacy`.
7. Thêm `GET /users/search` kèm rate limit.
8. Bỏ `avatarUrl` khỏi `updateProfile` trong `user.validation.js` và khỏi `allowedFields` trong `user.service.js`; avatar đã có route riêng.

Tiêu chí hoàn thành:

- toàn bộ user cũ có `username` sau backfill;
- hai user không thể có cùng `username`, kể cả khi gửi đồng thời;
- username sai định dạng hoặc thuộc blacklist bị từ chối;
- đổi username lần hai trong cooldown trả `409`;
- search không trả email và không trả chính user hiện tại.

### Phase 2 - Quan hệ bạn bè và chặn

Mục tiêu: đủ dữ liệu render danh sách bạn bè và hộp thư lời mời.

1. Tạo `pairKey.js`, `friendship.model.js`, `userBlock.model.js` với đủ index.
2. Viết `friend.service.js` theo state machine ở mục 8.
3. Viết `block.service.js` và helper kiểm tra chặn cho cả bản đơn lẻ và bản theo lô.
4. Thêm giới hạn `MAX_FRIENDS`, `MAX_PENDING_OUTGOING`, `MAX_BLOCKED`.
5. Thêm rate limit gửi lời mời và tìm kiếm.
6. Tạo controller, route, mount `/friends` và `/blocks`.
7. Thêm `GET /friends/summary` và `GET /users/:userId/profile` kèm `relationship`.

Nên tách helper thuần để test:

```js
toPairKey(idA, idB)
resolveRelationshipState(friendship, blocks, meId, targetId)
mapFriendUser(user, presence, friendship)
canSendRequest(friendship, now, cooldownHours)
```

Tiêu chí hoàn thành:

- gửi lời mời hai chiều đồng thời chỉ tạo một document và kết thúc ở `accepted`;
- accept hai lần liên tiếp: lần đầu `200`, lần sau `409`;
- accept lời mời của người khác trả `404`;
- chặn xong thì cả hai không thấy nhau ở mọi danh sách;
- bỏ chặn không tự phục hồi quan hệ cũ;
- vượt giới hạn bạn bè trả `409` và không tạo document.

### Phase 3 - Presence

Mục tiêu: chấm trạng thái trong danh sách bạn bè là thật.

1. Thêm namespace `/social` dùng lại `socketAuthMiddleware`.
2. Tạo `presence.service.js` với `setOnline`, `heartbeat`, `clear`, `getPresenceMap`, `countOnline`.
3. Tạo `presence.handler.js` xử lý connect, `presence:heartbeat`, disconnect.
4. Join socket vào room `user:<userId>` và tạo `emitToUser` trong `socialRealtime.service.js`.
5. Nối presence vào `GET /friends`, `GET /friends/summary`, `GET /conversations`.
6. Emit `presence:changed` tới bạn bè khi trạng thái tổng hợp đổi.

Tiêu chí hoàn thành:

- mở hai tab rồi đóng một tab vẫn `online`;
- đóng hết tab thì thành `offline` trong vòng `STALE_SECONDS`;
- kill tiến trình API không để lại presence vĩnh viễn nhờ TTL;
- Redis tắt thì `GET /friends` vẫn trả `200` với toàn bộ `offline`;
- không có lệnh Redis nào chạy trong vòng lặp theo số bạn bè.

### Phase 4 - Thông báo

Mục tiêu: chuông thông báo hoạt động và không spam.

1. Tạo `notification.model.js` và `notification.service.js`.
2. Ghi notification tại các điểm: nhận lời mời, lời mời được chấp nhận.
3. Emit `notification:new` qua `emitToUser` sau khi ghi DB thành công.
4. Thêm `GET /notifications` và `POST /notifications/read`.
5. Nối `unreadNotificationCount` vào `GET /friends/summary`.

Tiêu chí hoàn thành:

- notification được ghi trước khi emit, không có sự kiện mồ côi;
- user offline vẫn thấy notification khi quay lại;
- đánh dấu đã đọc là idempotent;
- huỷ lời mời hoặc chặn thì notification chưa đọc liên quan không còn hiển thị.

### Phase 5 - Nhắn tin

Mục tiêu: hộp thoại 1-1 dùng được, chịu được retry.

1. Tạo `conversation.model.js`, `conversationMember.model.js`, `directMessage.model.js` với đủ index.
2. Viết `conversation.service.js` theo mục 11.
3. Thêm REST: mở hội thoại, danh sách, lịch sử theo cursor, gửi, đọc.
4. Tạo `social.contract.js` và `directMessage.handler.js` cho `dm:send`, `dm:read`, `dm:typing`.
5. Thêm rate limit gửi tin theo mẫu `CHAT_RL`.
6. Nối `unreadMessageCount` vào `GET /friends/summary` và `conversationId` vào `GET /friends`.
7. Bật Redis adapter cho Socket.IO nếu môi trường chạy nhiều instance.

Tiêu chí hoàn thành:

- gửi cùng `clientMessageId` hai lần chỉ tạo một tin nhắn và cả hai lần đều thành công;
- `unreadCount` của hai phía độc lập nhau;
- phân trang cursor không trả trùng khi có tin mới xen vào;
- hủy kết bạn thì đọc được lịch sử nhưng gửi tin trả `403`;
- gửi tin qua REST và qua socket cho cùng kết quả trong DB;
- gửi nhiều tin liên tiếp chỉ tạo một notification chưa đọc cho hội thoại.

### Phase 6 - Hoạt động gần đây

Mục tiêu: feed bên phải màn hình có dữ liệu thật.

1. Tạo `activityEvent.model.js` và `activityEvent.service.js`.
2. Nối điểm ghi event vào quiz, learn và streak theo bảng ở mục 12.1.
3. Bọc mọi lệnh ghi event trong try/catch, không làm fail hành động học.
4. Thêm `GET /friends/activities` với lọc chặn và lọc `private`.
5. Snapshot `deckTitle` khi ghi event.

Tiêu chí hoàn thành:

- deck bị xóa sau đó, feed vẫn hiển thị đúng tên deck tại thời điểm học;
- user đặt `private` thì hoạt động mới và cũ đều không xuất hiện ở feed bạn bè;
- lỗi ghi event không làm submit quiz thất bại;
- event của chính user không lọt vào feed bạn bè;
- user chưa có bạn nhận empty state mà không chạy truy vấn `$in` rỗng.

## 15. Bảo mật và quyền riêng tư

- Mọi route đều đi qua `authMiddleware`; không có endpoint bạn bè nào công khai.
- Không bao giờ trả `email`, `passwordHash`, `defaultQuizSize` hay `__v` của user khác.
- Không tiết lộ việc bị chặn. Người bị chặn phải nhận cùng loại lỗi như khi người kia không tồn tại.
- Không tiết lộ sự tồn tại của lời mời không thuộc về mình: dùng `404`, không dùng `403`.
- Search email chỉ khớp tuyệt đối, để không dò được danh sách email theo prefix.
- `username` là dữ liệu công khai; nói rõ điều này ở tài liệu API và ở UI đặt username.
- Presence chỉ được trả cho bạn bè đã accepted. Người lạ không biết được user có đang online.
- `GET /users/:userId/profile` chỉ trả số liệu học tập khi hai bên là bạn và chủ hồ sơ không đặt `private`; ngược lại chỉ trả `username`, `displayName`, `avatarUrl`, `relationship`.
- Rate limit bắt buộc, dùng `rateLimitMiddleware` sẵn có:

| Hành động           | Giới hạn đề xuất     |
| ------------------- | -------------------- |
| Gửi lời mời kết bạn | 20 lần / giờ / user  |
| Tìm người dùng      | 30 lần / phút / user |
| Đổi username        | 5 lần / ngày / user  |
| Gửi tin nhắn        | 10 lần / 10 giây     |
| Chặn hoặc bỏ chặn   | 30 lần / giờ / user  |

- Socket payload luôn được validate bằng Joi và `stripUnknown: true`.
- Không log nội dung tin nhắn, access token hay email. Log chỉ chứa id và loại hành động.
- `clientMessageId` do client sinh không được dùng làm khóa tin cậy cho quyền; luôn kiểm tra `senderId` từ token.

## 16. Kiểm thử bắt buộc

### 16.1 Username và tìm kiếm

- [ ] Backfill tạo username hợp lệ cho toàn bộ user cũ và chạy lại không đổi kết quả.
- [ ] Hai request đặt cùng username đồng thời chỉ một cái thành công, cái còn lại nhận `409`.
- [ ] Username có ký tự hoa được lưu ở dạng lowercase.
- [ ] Username `admin` bị từ chối.
- [ ] Username chứa hai dấu chấm liền nhau bị từ chối.
- [ ] Đổi username lần hai trong cooldown trả `409` kèm thời điểm được đổi lại.
- [ ] Search theo prefix username trả đúng.
- [ ] Search theo email chỉ khớp email đầy đủ.
- [ ] Search không trả chính user hiện tại và không trả email.
- [ ] Search loại bỏ người đã chặn và người đã chặn mình.

### 16.2 Quan hệ bạn bè

- [ ] User mới nhận empty state ở toàn bộ endpoint bạn bè.
- [ ] Gửi lời mời cho chính mình trả `400`.
- [ ] Gửi lời mời lần hai theo cùng hướng trả `409`.
- [ ] A gửi cho B rồi B gửi cho A: kết quả là một document `accepted`.
- [ ] Hai request gửi chéo chạy đồng thời không tạo hai document.
- [ ] Accept bởi người không phải addressee trả `404`.
- [ ] Accept hai lần: lần sau trả `409`.
- [ ] Decline rồi gửi lại ngay trả `429` kèm `retryAfterSeconds`.
- [ ] Decline rồi gửi lại sau cooldown thành công và dùng lại đúng document cũ.
- [ ] Cancel lời mời đã gửi xóa document.
- [ ] Hủy kết bạn từ cả hai phía đều hoạt động.
- [ ] Hủy kết bạn với người không phải bạn trả `404`.
- [ ] Vượt `MAX_FRIENDS` trả `409`.
- [ ] Vượt `MAX_PENDING_OUTGOING` trả `409`.
- [ ] `GET /friends` của hai user không lẫn dữ liệu.
- [ ] `relationship.state` đúng cho cả sáu trạng thái.

### 16.3 Chặn người dùng

- [ ] Chặn xóa quan hệ bạn bè đang có.
- [ ] Chặn hai lần là idempotent.
- [ ] Người bị chặn không gửi được lời mời và nhận lỗi giống trường hợp không tồn tại.
- [ ] Người bị chặn không thấy trong search, friends, feed của người chặn.
- [ ] Người chặn không xuất hiện trong feed của người bị chặn.
- [ ] Bỏ chặn không phục hồi quan hệ bạn bè.
- [ ] Không tồn tại đồng thời `UserBlock` và `Friendship` accepted cho cùng cặp user.

### 16.4 Presence

- [ ] Hai tab, đóng một tab, vẫn `online`.
- [ ] Đóng hết tab thì `offline` sau `STALE_SECONDS`.
- [ ] Không heartbeat thì key tự hết hạn.
- [ ] Tất cả field `idle` thì trạng thái tổng hợp là `idle`.
- [ ] Presence chỉ trả cho bạn bè; người lạ không có field `presence`.
- [ ] Redis lỗi thì `GET /friends` vẫn `200` với toàn bộ `offline`.
- [ ] `presence:changed` chỉ được emit khi trạng thái tổng hợp đổi.

### 16.5 Thông báo

- [ ] Nhận lời mời tạo đúng một notification.
- [ ] Chấp nhận lời mời tạo notification cho người gửi.
- [ ] User offline vẫn thấy notification khi đăng nhập lại.
- [ ] `POST /notifications/read` với `all: true` reset `unreadCount` về `0`.
- [ ] Đánh dấu đã đọc hai lần không lỗi.
- [ ] Notification của user khác không đọc được.

### 16.6 Nhắn tin

- [ ] Mở hội thoại hai lần trả cùng `conversationId`.
- [ ] Hai request mở hội thoại đồng thời chỉ tạo một document.
- [ ] Gửi cùng `clientMessageId` hai lần chỉ tạo một tin nhắn.
- [ ] `unreadCount` chỉ tăng ở phía người nhận.
- [ ] Đánh dấu đã đọc reset `unreadCount` về `0`.
- [ ] `lastReadMessageId` cũ hơn không làm `unreadCount` sai.
- [ ] Cursor phân trang không trả tin trùng khi có tin mới xen vào.
- [ ] Đọc hội thoại không thuộc về mình trả `404`.
- [ ] Gửi tin sau khi hủy kết bạn trả `403`.
- [ ] Gửi tin cho người đã chặn mình trả `403` với thông điệp trung tính.
- [ ] Body vượt `BODY_MAX` bị từ chối cả ở REST và socket.
- [ ] Vượt rate limit gửi tin trả lỗi `RATE_LIMITED` qua ack.
- [ ] Gửi 10 tin liên tiếp chỉ tạo một notification chưa đọc.

### 16.7 Hoạt động gần đây

- [ ] Submit quiz tạo `quiz_completed`.
- [ ] Điểm từ `HIGH_SCORE_THRESHOLD` trở lên tạo thêm `quiz_high_score`.
- [ ] Học deck lần đầu tạo `learn_started`, lần sau không tạo lại.
- [ ] Chạm mốc streak `7` tạo `streak_reached` đúng một lần.
- [ ] Deck bị xóa vẫn hiển thị đúng `deckTitle` trong feed.
- [ ] User `private` không xuất hiện trong feed bạn bè.
- [ ] Event của chính user không có trong feed bạn bè.
- [ ] Lỗi ghi event không làm submit quiz thất bại.
- [ ] Không có bạn bè thì trả empty state ngay.

## 17. Hiệu năng

- Mọi truy vấn danh sách phải có `limit` và `select`/projection.
- Không `populate` trong vòng lặp. Lấy tập id rồi `find({ _id: { $in: ids } })` một lần.
- Không gọi Redis trong vòng lặp. Dùng pipeline.
- Không đếm bạn bè bằng cách load toàn bộ document; dùng `countDocuments` trên index.
- `GET /friends/summary` được gọi rất thường xuyên: giữ nó ở mức các lệnh count trên index cộng một pipeline Redis. Nếu cần, cache trong Redis với TTL `10` giây theo key `social:v1:summary:<userId>` và invalidate khi có accept, unfriend, block, tin nhắn mới hoặc notification mới.
- Mục tiêu ban đầu: p95 của `GET /friends`, `GET /friends/requests`, `GET /conversations` dưới `300` ms; `GET /friends/activities` dưới `500` ms trên dữ liệu đại diện.
- Fan-out `presence:changed` là chi phí tăng theo số bạn bè. Đặt ngưỡng và bỏ qua fan-out khi vượt, thay bằng poll ở client.
- Chỉ thêm cache khi đã đo. Không cache chung dữ liệu cá nhân giữa nhiều user.

## 18. Quan sát khi vận hành

Structured log:

```text
event=friend.request_created requesterId addresseeId result
event=friend.request_auto_accepted userA userB
event=friend.request_responded requestId addresseeId action
event=friend.removed actorId targetId
event=friend.blocked blockerId blockedId hadFriendship
event=friend.invariant_violation pairKey reason
event=presence.changed userId status connections
event=presence.fanout_skipped userId friendCount
event=dm.sent conversationId senderId bytes deduped
event=dm.read conversationId userId
event=notification.created userId type actorId
event=activity.recorded userId type visibility
event=activity.record_failed userId type reason
```

Không log nội dung tin nhắn, email hay access token.

Theo dõi:

- p50/p95/p99 của các endpoint bạn bè và hội thoại;
- tỷ lệ lời mời được chấp nhận so với bị từ chối;
- số lần trúng `E11000` trên `friendship` và `direct_message` (cao bất thường nghĩa là client retry sai);
- số user online đồng thời và số socket trên mỗi user;
- tỷ lệ `presence.fanout_skipped`;
- tỷ lệ `activity.record_failed`;
- số lần vượt rate limit theo từng loại hành động.

## 19. Definition of Done

- [ ] Toàn bộ user có `username` unique và API đổi username có cooldown.
- [ ] `GET /users/search` trả đúng `relationship.state` cho mọi trạng thái quan hệ.
- [ ] Một cặp user không thể có hai document `Friendship`, kể cả khi gửi lời mời đồng thời.
- [ ] Gửi lời mời chéo nhau tự động thành bạn bè.
- [ ] Accept, decline, cancel, unfriend đều idempotent hoặc trả mã lỗi đúng khi lặp lại.
- [ ] Chặn người dùng có hiệu lực trên mọi truy vấn bạn bè, lời mời, feed và tin nhắn.
- [ ] Trạng thái online phản ánh đúng nhiều tab và nhiều thiết bị, tự dọn khi mất kết nối.
- [ ] Presence chỉ hiển thị cho bạn bè.
- [ ] Notification được ghi vào MongoDB trước khi emit socket và lấy lại được qua REST.
- [ ] Nhắn tin 1-1 chịu được retry nhờ `clientMessageId` và không tạo tin trùng.
- [ ] `unreadCount` của hai phía độc lập và reset đúng khi đã đọc.
- [ ] Feed hoạt động chỉ chứa event của bạn bè, tôn trọng `activityVisibility`, và không phụ thuộc deck còn tồn tại.
- [ ] Lỗi ghi activity event hoặc lỗi Redis không làm fail request chính.
- [ ] Không endpoint nào trả email hay dữ liệu nội bộ của user khác.
- [ ] Rate limit đã áp cho gửi lời mời, tìm kiếm, đổi username, gửi tin, chặn.
- [ ] Toàn bộ index ở mục 6 đã được kiểm tra trên staging bằng `getIndexes()`.
- [ ] Unit test helper, service test và API integration test bắt buộc đều đạt.
- [ ] Redis adapter cho Socket.IO đã bật nếu môi trường chạy nhiều instance.
- [ ] `swagger/swagger.json` và `postman/HIT-Product.collection.json` đã cập nhật.

## 20. Nguồn tham khảo

Nguồn nội bộ:

- [docs/dashboard.md](docs/dashboard.md) - cấu trúc tài liệu canonical và Definition of Done.
- [src/models/roomMessage.model.js](src/models/roomMessage.model.js) - mẫu dedup tin nhắn theo `clientMessageId`.
- [src/sockets/handlers/chat.handler.js](src/sockets/handlers/chat.handler.js) - mẫu handler socket kèm validate và rate limit.
- [src/sockets/utils/socketHandler.js](src/sockets/utils/socketHandler.js) - `safeHandler` và `socketError`.
- [src/constants/studyRoom.constant.js](src/constants/studyRoom.constant.js) - mẫu constant, Redis key và thông số presence.
- [src/services/client/studyActivity.service.js](src/services/client/studyActivity.service.js) - mẫu upsert chịu `E11000` và tính streak.
- [src/services/client/studyRoom.service.js](src/services/client/studyRoom.service.js) - mẫu phân trang `{ items, pagination }`.
- [src/middlewares/rateLimit.middleware.js](src/middlewares/rateLimit.middleware.js) - rate limit theo user.

Khi code hoặc contract thay đổi, cập nhật trước các mục: **Trạng thái hiện tại**, **Nguồn sự thật**, **Mô hình dữ liệu**, **REST contract**, **File map** và **Definition of Done**.
