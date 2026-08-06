# Kế hoạch implement tính năng Bạn bè

> **Đối tượng sử dụng:** Developer trực tiếp tự viết và kiểm thử code  
> **Trạng thái:** Sẵn sàng để bắt đầu implement  
> **Ngày lập:** 2026-08-04  
> **Spec canonical:** [`docs/friends.md`](friends.md)  
> **Phạm vi:** Backend Express, Mongoose, Redis và Socket.IO  
> **Cách dùng:** Bạn thực hiện lần lượt `FR-01` đến `FR-12`; hoàn thành và kiểm tra từng chặng trước khi sang chặng tiếp theo.

Đây là checklist kỹ thuật dành cho bạn tự implement, không phải prompt yêu cầu AI tự sửa code. Tài liệu không thay thế spec. Khi contract, model, mã lỗi hoặc quy tắc nghiệp vụ khác với tài liệu này, `docs/friends.md` là nguồn sự thật. Nếu phải thay đổi quyết định kiến trúc, dừng implement và cập nhật spec trước.

## 1. Cách bắt đầu tự implement

Ở mỗi chặng `FR-xx`, bạn làm theo cùng một vòng lặp:

1. Đọc mục tương ứng trong `docs/friends.md`, đặc biệt là model, contract và test bắt buộc.
2. Mở danh sách **Files** của chặng để biết file nào cần tạo hoặc sửa.
3. Làm lần lượt từng **Task**: viết test trước, chạy để xác nhận test đang lỗi, rồi mới viết code.
4. Chạy lệnh **Verify** của task; chỉ chuyển task khi test đã xanh.
5. Đối chiếu dòng **Hoàn thành chặng khi** trước khi sang `FR` tiếp theo.
6. Commit sau mỗi task nếu bạn muốn giữ lịch sử thay đổi nhỏ, dễ review và rollback.

Bắt đầu với `FR-01`. Bạn chưa cần tạo route hay service bạn bè ngay; trước tiên chỉ tạo constant, helper `toPairKey`, mở rộng `User` và viết schema test.

## 2. Kết quả cần đạt

Sau khi hoàn thành toàn bộ plan, backend phải cung cấp được:

- username, privacy, tìm kiếm và hồ sơ người dùng;
- lời mời, danh sách bạn bè, hủy kết bạn, chặn và bỏ chặn;
- presence nhiều tab/nhiều thiết bị qua Redis;
- notification lưu bền và đẩy realtime;
- hội thoại và tin nhắn 1-1 chịu được retry;
- feed hoạt động học tập tôn trọng quyền riêng tư;
- Swagger, Postman, test và checklist rollout.

Các hạng mục ngoài MVP trong mục 2 của `docs/friends.md` không được tự ý thêm vào plan.

## 3. Nguyên tắc thực thi

1. Dùng Node test runner hiện có; không thêm test framework nếu chưa có lý do bắt buộc.
2. Với logic có input/output rõ ràng, viết test lỗi trước, chạy thấy lỗi, rồi mới implement.
3. Mỗi plan chỉ sửa các file được liệt kê. Nếu phát hiện thay đổi kiến trúc ngoài phạm vi, dừng và cập nhật plan.
4. Mọi truy vấn đều scope bằng user đã xác thực; không nhận `userId` chủ thể từ body.
5. Không `populate` hoặc gọi Redis trong vòng lặp. Dùng truy vấn theo tập id và Redis pipeline.
6. Xử lý `E11000` là một nhánh nghiệp vụ dự kiến cho username, friendship, conversation và direct message.
7. MongoDB là nguồn sự thật; socket chỉ đẩy dữ liệu đã ghi thành công.
8. Lỗi Redis presence hoặc lỗi ghi activity phụ không được làm fail request chính.
9. Cập nhật barrel `index.js` trong cùng task tạo module mới.
10. Sau mỗi task: chạy test hẹp và review diff. Các commit ghi trong tài liệu chỉ là gợi ý, không bắt buộc.

## 4. Bản đồ phụ thuộc

| Đợt | Chặng | Phụ thuộc | Kết quả |
| --- | --- | --- | --- |
| 1 | FR-01 | Không | Constant, schema User và helper nền |
| 2 | FR-02 | FR-01 | Username, privacy và backfill |
| 2 | FR-03 | FR-01 | Search và public profile |
| 3 | FR-04 | FR-01 | Model quan hệ, chặn và helper thuần |
| 4 | FR-05 | FR-03, FR-04 | Request, friend list và summary |
| 5 | FR-06 | FR-05 | Block/unblock xuyên suốt quan hệ |
| 6 | FR-07 | FR-05 | Presence và namespace `/social` |
| 6 | FR-08 | FR-05 | Notification lưu bền |
| 7 | FR-09 | FR-06, FR-08 | Conversation và DirectMessage REST |
| 8 | FR-10 | FR-07, FR-09 | Direct message realtime |
| 8 | FR-11 | FR-06 | Activity event và friends feed |
| 9 | FR-12 | FR-02..FR-11 | Contract docs, regression và rollout |

Nếu bạn làm tuần tự, chỉ cần đi theo thứ tự `FR-01` đến `FR-12`. Các đợt trong bảng cho biết phần nào có thể làm song song, nhưng không bắt buộc. Khi hai chặng cùng chạm barrel hoặc router, hoàn thành chặng có số nhỏ trước.

## 5. Ma trận yêu cầu

| ID | Yêu cầu | Plan chịu trách nhiệm |
| --- | --- | --- |
| R-USER | Username, privacy, search, profile | FR-01, FR-02, FR-03 |
| R-FRIEND | Request, accept, decline, cancel, list, unfriend | FR-04, FR-05 |
| R-BLOCK | Block/unblock và lọc hai chiều | FR-04, FR-06 |
| R-PRESENCE | Online/idle/offline nhiều kết nối | FR-07 |
| R-NOTIFY | Notification REST và realtime | FR-08 |
| R-DM | Conversation, message, unread, read, retry | FR-09, FR-10 |
| R-ACTIVITY | Activity event, privacy và feed | FR-11 |
| R-OPS | Security, performance, docs và rollout | FR-12 |

## 6. Các chặng implement chi tiết

### FR-01 — Nền tảng social và mở rộng User

**Mục tiêu:** schema, constant và helper nền tồn tại trước khi mở API.

**Files:**

- Tạo `src/constants/social.constant.js`, `src/utils/pairKey.js`.
- Sửa `src/constants/user.constant.js`, `src/constants/index.js`.
- Sửa `src/models/user.model.js`.
- Tạo `test/social/pairKey.test.js`, `test/social/user-schema.test.js`.

#### Task 1 — Khóa constant và helper cặp user

- Viết test cho `toPairKey`: luôn sort ObjectId theo chuỗi hex, không phụ thuộc thứ tự input, từ chối hai id giống nhau hoặc id không hợp lệ.
- Implement `toPairKey` một lần duy nhất trong `src/utils/pairKey.js`.
- Khai báo enum, limit, cooldown, Redis key và event name đúng mục 6.8 của spec; dùng `Object.freeze` cho object cấu hình bất biến.
- Export social constant qua barrel.

**Verify:** `node --test test/social/pairKey.test.js`  
**Commit:** `feat(friends-01): add social constants and pair helper`

#### Task 2 — Mở rộng User schema an toàn

- Viết schema contract test cho `username`, `usernameUpdatedAt`, `activityVisibility`, `friendRequestPolicy` và index unique sparse.
- Thêm field và index đúng mục 6.1; không đặt `unique: true` trực tiếp trên field `username`.
- Giữ tương thích user cũ với `username = null`.

**Verify:** `node --test test/social/user-schema.test.js`  
**Commit:** `feat(friends-01): extend user social schema`

**Hoàn thành chặng khi:** import app không lỗi, schema test xanh, `User` cũ không bị validate fail.

---

### FR-02 — Username, privacy và backfill

**Mục tiêu:** mỗi user có handle ổn định và có API tự quản lý privacy.

**Files:**

- Tạo `scripts/backfill-usernames.js`.
- Sửa `src/validations/client/user.validation.js`.
- Sửa `src/services/client/user.service.js`.
- Sửa `src/controllers/client/user.controller.js`, `src/routers/client/user.route.js`.
- Tạo `test/social/username.service.test.js`, `test/social/username-backfill.test.js`.

#### Task 1 — Validation và service username/privacy

- Viết test cho normalize, regex, blacklist, cooldown, lowercase và map lỗi duplicate key sang `409`.
- Implement `setUsername`, `checkUsernameAvailable`, `updatePrivacy` trong user service.
- Loại `avatarUrl` khỏi `updateProfile` validation và `allowedFields`; route avatar riêng vẫn hoạt động.
- Không cho `PUT /users/me` cập nhật ba field social.

**Verify:** `node --test test/social/username.service.test.js test/user/cloudinary-avatar.test.js`  
**Commit:** `feat(friends-02): add username and privacy services`

#### Task 2 — Route và response contract

- Thêm validation/controller/route cho `PUT /users/me/username`, `GET /users/username-available`, `PUT /users/me/privacy`.
- Khai báo route tĩnh trước route `/:userId/profile` sẽ thêm ở FR-03.
- Áp rate limit đổi username; response dùng wrapper `{ statusCode, message, data }` hiện có.

**Verify:** test controller/route phải xác nhận auth, validation và status `200/400/409/429`.  
**Commit:** `feat(friends-02): expose username and privacy APIs`

#### Task 3 — Backfill chạy lặp an toàn

- Viết hàm thuần sinh candidate từ phần local của email, chuẩn hóa và thêm hậu tố khi trùng.
- Script chỉ xử lý user có `username: null`; chạy lại không đổi username đã gán.
- Hỗ trợ dry-run và batch; log count, không log email đầy đủ.
- Không tự chạy script trong startup của API.

**Verify:** test hai lần liên tiếp cho cùng fixture phải cho cùng kết quả; chạy dry-run trên môi trường dev trước khi update.  
**Commit:** `chore(friends-02): add idempotent username backfill`

**Hoàn thành chặng khi:** toàn bộ case mục 16.1 liên quan username/privacy xanh; index được tạo sau backfill theo runbook FR-12.

---

### FR-03 — Search và public profile

**Mục tiêu:** tìm user an toàn và trả relationship shape thống nhất.

**Files:**

- Sửa `src/validations/client/user.validation.js`, `src/services/client/user.service.js`.
- Sửa `src/controllers/client/user.controller.js`, `src/routers/client/user.route.js`.
- Tạo `test/social/user-search.service.test.js`.

#### Task 1 — Search projection và phân trang

- Viết test cho prefix username, display name, email exact, loại chính mình và không trả email.
- Implement `GET /users/search` đúng mục 7.7, có `page/limit`, projection whitelist và rate limit.
- Chưa tự đoán quan hệ trong task này; trả shape sẵn để FR-05 nối resolver.

**Verify:** `node --test test/social/user-search.service.test.js`  
**Commit:** `feat(friends-03): add safe user search`

#### Task 2 — Public profile và route precedence

- Thêm `GET /users/:userId/profile` với projection tối thiểu.
- Route `search`, `username-available`, `me/*` phải đứng trước `/:userId/profile`.
- Test `GET /users/search` không bị Express hiểu `search` là ObjectId.
- FR-05 sẽ bổ sung relationship và FR-11 sẽ bổ sung dữ liệu học tập theo privacy.

**Verify:** route contract test cho các path tĩnh và động.  
**Commit:** `feat(friends-03): add public user profile`

**Hoàn thành chặng khi:** search không rò email/dữ liệu nội bộ và mọi danh sách đều có limit.

---

### FR-04 — Persistence và helper quan hệ

**Mục tiêu:** database enforce được invariant một document cho mỗi cặp user.

**Files:**

- Tạo `src/models/friendship.model.js`, `src/models/userBlock.model.js`.
- Sửa `src/models/index.js`.
- Tạo `src/services/client/friendRelationship.js`.
- Tạo `test/social/friend-model.test.js`, `test/social/friend-relationship.test.js`.

#### Task 1 — Model và index

- Viết schema test cho field, timestamps và toàn bộ index ở mục 6.2–6.3.
- Implement `Friendship` và `UserBlock`; unique pair phải do DB enforce.
- Model hook/validation phải bảo vệ `userA < userB`, requester/addressee khác nhau và cùng tập user.

**Verify:** `node --test test/social/friend-model.test.js`  
**Commit:** `feat(friends-04): add friendship and block models`

#### Task 2 — Helper thuần cho state machine

- Viết test bảng cho `resolveRelationshipState`, `canSendRequest`, `mapFriendUser` và block hai chiều.
- Implement helper không truy cập DB để service sau có thể test độc lập.
- Bao phủ đủ sáu state trong mục 7.7 và invariant mục 5.1.

**Verify:** `node --test test/social/friend-relationship.test.js`  
**Commit:** `feat(friends-04): add relationship state helpers`

**Hoàn thành chặng khi:** index contract xanh và helper không phụ thuộc thứ tự cặp user.

---

### FR-05 — Friend requests, list và summary

**Mục tiêu:** hoàn chỉnh state machine quan hệ và REST chính của màn Bạn bè.

**Files:**

- Tạo `src/validations/client/friend.validation.js`.
- Tạo `src/services/client/friend.service.js`.
- Tạo `src/controllers/client/friend.controller.js`, `src/routers/client/friend.route.js`.
- Sửa các barrel và `src/routers/client/index.js`.
- Sửa user search/profile để dùng relationship resolver.
- Tạo `test/social/friend.service.test.js`, `test/social/friend-api.test.js`.

#### Task 1 — State transition có compare-and-set

- Viết test trước cho send, cross-send auto-accept, accept, decline, cancel, resend cooldown và unfriend.
- Implement transition bằng filter chứa current status; không read-modify-save cho transition cạnh tranh.
- Map `E11000` thành việc đọc lại document và giải quyết state hiện tại, không trả `500`.
- Enforce `MAX_FRIENDS`, `MAX_PENDING_OUTGOING` và rate limit trước khi ghi.

**Verify:** service test bao phủ retry và ownership; integration test concurrency phải chứng minh chỉ có một document.  
**Commit:** `feat(friends-05): implement friendship state machine`

#### Task 2 — List, request inbox và summary

- Implement `GET /friends`, `GET /friends/requests`, `GET /friends/summary` với empty state đúng spec.
- Query user theo tập id một lần, giữ thứ tự sau khi map; không populate trong loop.
- Summary ở phase này trả count có sẵn; notification, unread message và online count được nối ở plan sau.

**Verify:** test user isolation, pagination, incoming/outgoing ownership và empty state.  
**Commit:** `feat(friends-05): add friend lists and summary`

#### Task 3 — REST adapter và relationship integration

- Thêm controller, validation, route và mount `/friends`.
- Nối relationship state vào search và public profile bằng batch query, không query từng item.
- Chuẩn hóa status/error theo mục 7.11; request không thuộc user trả `404`.

**Verify:** `node --test test/social/friend.service.test.js test/social/friend-api.test.js`  
**Commit:** `feat(friends-05): expose friendship APIs`

**Hoàn thành chặng khi:** toàn bộ case mục 16.2 xanh và API không lẫn dữ liệu giữa user.

---

### FR-06 — Block và unblock xuyên suốt

**Mục tiêu:** block có hiệu lực nhất quán trên mọi hành vi social đã tồn tại.

**Files:**

- Tạo `src/services/client/block.service.js`.
- Tạo `src/controllers/client/block.controller.js`, `src/routers/client/block.route.js`.
- Mở rộng `src/validations/client/friend.validation.js` và các barrel/router.
- Sửa `src/services/client/friend.service.js`, `src/services/client/user.service.js`.
- Tạo `test/social/block.service.test.js`, `test/social/block-api.test.js`.

#### Task 1 — Block service và cleanup quan hệ

- Viết test cho block idempotent, tự block, max blocked, unblock và không phục hồi friendship.
- Khi block: upsert `UserBlock`, xóa friendship của cặp và dọn notification liên quan chưa đọc trong cùng luồng có kiểm soát.
- Nếu cleanup sau upsert lỗi, retry phải tiếp tục hoàn tất cleanup; không coi block đã tồn tại là lý do bỏ qua.

**Verify:** service test chứng minh không còn `accepted` friendship sau block.  
**Commit:** `feat(friends-06): implement block lifecycle`

#### Task 2 — Lọc block hai chiều và API

- Thêm `GET /blocks`, `POST /blocks`, `DELETE /blocks/:userId`.
- Áp bulk block filter vào search, profile, requests, list và mọi action friend.
- Trả lỗi trung tính để không tiết lộ bên nào đã block.

**Verify:** `node --test test/social/block.service.test.js test/social/block-api.test.js`  
**Commit:** `feat(friends-06): enforce blocking across social APIs`

**Hoàn thành chặng khi:** toàn bộ case mục 16.3 xanh; không đồng thời tồn tại block và accepted friendship cho cùng cặp.

---

### FR-07 — Presence và namespace `/social`

**Mục tiêu:** trạng thái online/idle/offline đúng với nhiều tab và tự hết hạn.

**Files:**

- Tạo `src/services/client/presence.service.js`.
- Tạo `src/sockets/contracts/social.contract.js`.
- Tạo `src/sockets/handlers/presence.handler.js`.
- Tạo `src/sockets/services/socialRealtime.service.js`.
- Sửa `src/sockets/index.js`, `src/services/client/friend.service.js`.
- Tạo `test/social/presence.service.test.js`, `test/social/presence-socket.test.js`.

#### Task 1 — Presence service dùng Redis pipeline

- Viết test cho nhiều connection, idle aggregation, TTL, clear và Redis failure fallback.
- Implement key/hash lifecycle đúng mục 9; `getPresenceMap` và `countOnline` phải pipeline.
- Không để `disconnect` của một tab xóa trạng thái tab khác.

**Verify:** `node --test test/social/presence.service.test.js`  
**Commit:** `feat(friends-07): add Redis presence service`

#### Task 2 — Namespace, user room và fan-out

- Tạo `/social`, dùng lại `socketAuthMiddleware`, join `user:<userId>`.
- Register connect, heartbeat, disconnect; validate payload với Joi và `stripUnknown`.
- Implement `emitToUser`; chỉ emit `presence:changed` khi aggregate state đổi và tôn trọng fan-out cap.
- Không ảnh hưởng namespace `/study-rooms`.

**Verify:** socket test hai tab/đóng một tab và test namespace cũ vẫn đăng ký handler.  
**Commit:** `feat(friends-07): add social presence realtime`

#### Task 3 — Nối presence vào REST

- Batch đọc presence cho `GET /friends`; nối `onlineCount` vào summary.
- Chỉ bạn accepted mới nhận presence; Redis lỗi thì map toàn bộ `offline` và log warning.

**Verify:** test không có Redis call trong loop và `GET /friends` vẫn `200` khi Redis lỗi.  
**Commit:** `feat(friends-07): expose friend presence in REST`

**Hoàn thành chặng khi:** toàn bộ case mục 16.4 xanh.

---

### FR-08 — Notification lưu bền

**Mục tiêu:** mọi notification được lấy lại qua REST sau khi client offline.

**Files:**

- Tạo `src/models/notification.model.js`.
- Tạo `src/validations/client/notification.validation.js`.
- Tạo `src/services/client/notification.service.js`.
- Tạo controller/route tương ứng và sửa barrel/router.
- Sửa `src/services/client/friend.service.js`.
- Tạo `test/social/notification.service.test.js`, `test/social/notification-api.test.js`.

#### Task 1 — Model, list và read

- Viết schema/index test và service test cho list, unread count, read ids, read all, ownership và idempotency.
- Implement model/service theo mục 6.6 và 7.10; mọi list có projection và pagination.
- Thêm `GET /notifications`, `POST /notifications/read`.

**Verify:** test read của user khác không thay đổi document.  
**Commit:** `feat(friends-08): add notification persistence APIs`

#### Task 2 — Ghi trước, emit sau

- Tích hợp tạo notification khi nhận request và khi request được accept.
- Chỉ gọi `emitToUser` sau khi MongoDB ghi thành công; realtime failure không rollback notification.
- Dùng dedup key phù hợp để retry friend transition không tạo notification trùng.
- Nối `unreadNotificationCount` vào friend summary.

**Verify:** `node --test test/social/notification.service.test.js test/social/notification-api.test.js`  
**Commit:** `feat(friends-08): integrate durable friend notifications`

**Hoàn thành chặng khi:** toàn bộ case mục 16.5 xanh và user offline lấy lại đủ notification.

---

### FR-09 — Conversation và DirectMessage REST

**Mục tiêu:** nhắn tin 1-1 lưu bền, phân trang ổn định và chịu retry.

**Files:**

- Tạo `src/models/conversation.model.js`, `conversationMember.model.js`, `directMessage.model.js`.
- Tạo `src/validations/client/conversation.validation.js`.
- Tạo `src/services/client/conversation.service.js`.
- Tạo controller/route và sửa barrel/router.
- Sửa friend summary/list.
- Tạo `test/social/conversation-model.test.js`, `conversation.service.test.js`, `conversation-api.test.js`.

#### Task 1 — Model và mở hội thoại idempotent

- Viết schema/index test đúng mục 6.4–6.5.
- Implement open/get-or-create theo pair key; xử lý `E11000` bằng đọc lại conversation thắng race.
- Tạo đủ hai ConversationMember; retry phải hoàn tất member bị thiếu thay vì trả dữ liệu nửa vời.

**Verify:** concurrency test chỉ có một conversation và đúng hai member.  
**Commit:** `feat(friends-09): add direct conversation persistence`

#### Task 2 — Gửi, lịch sử và đánh dấu đọc

- Viết test `clientMessageId` dedup, friendship/block authorization, cursor, unread độc lập và monotonic read.
- Implement send bằng sender từ token; không tin `senderId` trong payload.
- Update last message và unread theo thứ tự chống retry; cùng message không được tăng unread hai lần.
- Sau unfriend/block: cho đọc lịch sử nếu là member nhưng cấm gửi mới.

**Verify:** service tests bao phủ retry, cursor xen tin mới và stale read marker.  
**Commit:** `feat(friends-09): implement durable direct messaging`

#### Task 3 — REST và summary integration

- Thêm open/list conversation, message history, send và read endpoints đúng mục 7.
- Nối `conversationId` vào friend item và `unreadMessageCount` vào summary.
- Tạo tối đa một notification chưa đọc cho mỗi conversation theo quy tắc spec.

**Verify:** `node --test test/social/conversation-*.test.js`  
**Commit:** `feat(friends-09): expose direct messaging REST APIs`

**Hoàn thành chặng khi:** REST đạt toàn bộ case mục 16.6 trừ socket-specific cases.

---

### FR-10 — Direct message realtime

**Mục tiêu:** REST và socket dùng chung service, cho cùng dữ liệu và mã lỗi tương đương.

**Files:**

- Tạo `src/sockets/handlers/directMessage.handler.js`.
- Sửa `src/sockets/contracts/social.contract.js`, `src/sockets/index.js`.
- Sửa `src/services/client/conversation.service.js` nếu cần adapter dùng chung.
- Sửa `src/sockets/services/socialRealtime.service.js`.
- Tạo `test/social/direct-message-socket.test.js`.

#### Task 1 — Socket send/read/typing

- Viết socket handler test cho `dm:send`, `dm:read`, `dm:typing`, invalid payload và ack error.
- Handler gọi cùng conversation service với REST; không chứa lại business logic.
- Áp Joi `stripUnknown`, body max và rate limit theo Redis key của user.
- `typing` không ghi DB và chỉ emit tới member còn lại khi vẫn được phép nhắn.

**Verify:** `node --test test/social/direct-message-socket.test.js`  
**Commit:** `feat(friends-10): add realtime direct messaging`

#### Task 2 — Delivery event và multi-instance

- Emit `dm:new`, `dm:read`, friend/notification events qua `user:<userId>`.
- Bật Redis adapter bằng pub/sub client riêng khi cấu hình multi-instance được bật; tránh dùng connection BullMQ-style cho subscription.
- Xử lý shutdown của pub/sub client cùng vòng đời server.
- Test contract rằng adapter failure khi boot được log/fail rõ, không tạo trạng thái nửa bật.

**Verify:** test REST và socket cùng `clientMessageId` chỉ tạo một message; chạy smoke test hai socket client.  
**Commit:** `feat(friends-10): wire social delivery across instances`

**Hoàn thành chặng khi:** toàn bộ case socket trong mục 16.6 xanh.

---

### FR-11 — Activity event và friends feed

**Mục tiêu:** feed hoạt động có snapshot, không ảnh hưởng luồng học và tôn trọng privacy hiện tại.

**Files:**

- Tạo `src/models/activityEvent.model.js`.
- Tạo `src/services/client/activityEvent.service.js`.
- Sửa `src/services/client/quiz.service.js`, `study.service.js`, `studyActivity.service.js` và điểm learn phù hợp.
- Sửa `src/services/client/friend.service.js`, friend controller/route/validation.
- Tạo `test/social/activity-event.service.test.js`, `activity-feed.test.js`.

#### Task 1 — Model và best-effort recorder

- Viết test schema/index, dedup event, snapshot `deckTitle` và log failure.
- Implement recorder theo mục 12.1; lỗi ghi được catch/log có cấu trúc và không throw vào request chính.
- Privacy được snapshot trên event nhưng feed vẫn kiểm tra `User.activityVisibility` hiện tại.

**Verify:** lỗi model create giả lập không làm helper caller reject.  
**Commit:** `feat(friends-11): add activity event recorder`

#### Task 2 — Nối các điểm phát sự kiện

- Quiz submit tạo `quiz_completed` và có điều kiện `quiz_high_score`.
- Learn/study tạo `learn_started` đúng một lần theo dedup key.
- Sửa `recordStudyActivity` trả metadata đủ để nhận biết streak milestone; không làm đổi contract caller hiện có ngoài phần đã chốt.
- Streak milestone chỉ tạo đúng một event.

**Verify:** test từng event source và test lỗi recorder không làm quiz/study fail.  
**Commit:** `feat(friends-11): record social learning activities`

#### Task 3 — Feed và profile privacy

- Implement `GET /friends/activities` theo đúng thứ tự lọc ở mục 12.2.
- Nếu không có friend id, trả empty state trước khi query ActivityEvent.
- Lọc block hai chiều, accepted friendship và privacy hiện tại; không đưa event của chính mình.
- Public profile chỉ trả số liệu học tập khi đủ quyền theo mục 15.

**Verify:** `node --test test/social/activity-*.test.js`  
**Commit:** `feat(friends-11): expose privacy-safe friend activity feed`

**Hoàn thành chặng khi:** toàn bộ case mục 16.7 xanh.

---

### FR-12 — Contract, regression và rollout

**Mục tiêu:** tính năng có thể bàn giao, deploy và rollback có kiểm soát.

**Files:**

- Sửa `swagger/swagger.json`, `postman/HIT-Product.collection.json`, `README.md`.
- Có thể tạo `docs/friends-rollout.md` nếu runbook dài.
- Chỉ sửa source khi regression test phát hiện bug thuộc spec; không thêm enhancement.

#### Task 1 — API/realtime contract docs

- Document toàn bộ endpoint, request/response, error code và socket event trong spec.
- Postman có flow: đặt username → search → request → accept → conversation → message → read → block.
- Nêu rõ access token/deviceId cho `/social`, username công khai và email không bao giờ xuất hiện trong public response.

**Verify:** parse `swagger/swagger.json`; import collection không lỗi; spot-check tên route với source.  
**Commit:** `docs(friends-12): publish social API contracts`

#### Task 2 — Regression và quality gates

- Chạy test hẹp `node --test test/social/*.test.js`, sau đó `npm test`.
- Kiểm tra route auth, response projection, query limit, Redis pipeline và structured logging.
- Chạy smoke test với MongoDB/Redis thật cho race: duplicate username, cross friend request, open conversation và duplicate clientMessageId.
- Ghi kết quả; không đánh dấu done nếu chỉ có unit stub cho invariant concurrency.

**Verify:** tất cả test xanh, process thoát code `0`.  
**Commit:** `test(friends-12): complete social regression coverage`

#### Task 3 — Migration và rollout

- Backup/xác nhận restore, chạy backfill dry-run, chạy backfill thật, kiểm tra duplicate/null.
- Tạo index unique sparse username và các social index; xác nhận bằng `getIndexes()` trên staging.
- Deploy API một instance, smoke REST/socket, sau đó mới scale nhiều instance và kiểm tra Redis adapter.
- Theo dõi log/metric mục 18; rollback application nếu lỗi, nhưng không xóa dữ liệu đã backfill.

**Verify:** checklist rollout bên dưới được ký nhận bằng timestamp và output kiểm tra.  
**Commit:** `docs(friends-12): add migration and rollout runbook`

**Hoàn thành chặng khi:** Definition of Done mục 19 trong spec được đánh dấu bằng bằng chứng test/operation, không chỉ đánh dấu thủ công.

## 7. Cổng kiểm thử cho từng chặng

Mỗi plan chỉ được đóng khi đạt cả bốn cổng:

1. **Contract:** response và error code khớp `docs/friends.md`.
2. **Isolation:** test chứng minh user A không đọc/sửa dữ liệu của user B.
3. **Retry/concurrency:** hành vi ghi quan trọng có test retry; invariant unique có integration test khi cần.
4. **Regression:** test hẹp xanh và `npm test` không phát sinh lỗi mới.

Lệnh chuẩn:

```powershell
node --test test/social/*.test.js
npm test
```

Nếu PowerShell không expand wildcard theo cách Node mong đợi, dùng:

```powershell
node --test "test/social/*.test.js"
```

## 8. Definition of Ready trước khi code

- [ ] MongoDB và Redis dev chạy được.
- [ ] Có ít nhất ba user fixture để test friend/block.
- [ ] Đã xác nhận `docs/friends.md` là spec canonical.
- [ ] Không có thay đổi chưa hiểu trong các file mà plan sắp sửa.
- [ ] Test hiện tại chạy xanh hoặc lỗi baseline đã được ghi lại.
- [ ] Bạn chỉ triển khai đúng một chặng tại một thời điểm.

## 9. Checklist rollout tối thiểu

- [ ] Backfill dry-run: tổng user, tổng cần cập nhật, tổng collision hợp lý.
- [ ] Backfill thật hoàn tất; chạy lại update count bằng `0`.
- [ ] Không có username duplicate; user chưa có username chỉ tồn tại nếu được miễn trừ rõ ràng.
- [ ] `getIndexes()` khớp mục 6 của spec.
- [ ] REST empty state trả `200` cho user mới.
- [ ] Cross request chỉ tạo một Friendship.
- [ ] Hai tab presence: đóng một tab vẫn online.
- [ ] User offline nhận lại notification qua REST.
- [ ] REST/socket retry cùng `clientMessageId` không tạo tin trùng.
- [ ] Activity recorder lỗi không làm quiz fail.
- [ ] Block loại user khỏi search, friend list và feed hai chiều.
- [ ] Không public response nào chứa email, passwordHash hoặc `__v`.
- [ ] p95 đạt mục tiêu mục 17 trên dữ liệu staging đại diện.
- [ ] Multi-instance chỉ bật sau khi Redis adapter được xác nhận.

## 10. Điểm dừng bắt buộc

Dừng implement và xin quyết định trước khi tiếp tục nếu gặp một trong các trường hợp:

- cần đổi từ một Friendship document sang hai document hoặc graph model;
- cần transaction nhiều collection để đảm bảo correctness;
- muốn cho người không phải bạn xem presence/activity;
- muốn cho phép nhắn tin khi chưa accepted;
- muốn thay Redis presence bằng MongoDB;
- cần đổi public REST/socket contract đã chốt;
- migration phát hiện dữ liệu không thỏa invariant mà không thể sửa xác định.

Các enhancement không chặn MVP phải ghi riêng, không chen vào 12 plan trên.
