# Hướng dẫn build Dashboard và tích hợp Cloudinary cho HITProduct

> **Trạng thái:** Canonical - dùng để triển khai Dashboard người học
> **Cập nhật:** 2026-07-31
> **Phạm vi:** Backend Express/Mongoose, frontend React và ảnh avatar/cover qua Cloudinary
> **Thay thế:** Tài liệu dashboard cũ trong `.note/docs/api-dashboard.md` chỉ nên dùng làm tài liệu tham khảo

Tài liệu này bám theo cách tổ chức của bộ tài liệu phòng học ảo: chốt phạm vi trước, xác định nguồn sự thật, định nghĩa contract, lập bản đồ file, triển khai theo thứ tự phụ thuộc, sau đó mới kiểm thử và rollout.

## 1. Cách sử dụng

Thực hiện tuần tự theo 5 phase:

1. Chốt contract và bổ sung index.
2. Xây API tổng hợp Dashboard.
3. Xây hạ tầng upload ảnh có chữ ký qua Cloudinary.
4. Nối avatar, cover deck và giao diện Dashboard.
5. Kiểm thử, quan sát và rollout.

Mỗi phase chỉ được xem là hoàn thành khi:

- contract response đã có test;
- dữ liệu của user này không thể lẫn sang user khác;
- empty state trả `200` với số `0` và mảng rỗng;
- lỗi của một truy vấn hoặc upload không tạo dữ liệu nửa vời;
- frontend có loading, empty, error và retry state.

Không triển khai Dashboard admin trong tài liệu này. Từ `Dashboard` bên dưới luôn có nghĩa là màn hình tổng quan học tập cá nhân S03.

## 2. Phạm vi MVP đã chốt

Người dùng đã đăng nhập có thể:

1. Xem lời chào và avatar hiện tại.
2. Xem tổng số bộ thẻ, thư mục và thẻ trong thư viện của mình.
3. Xem số thẻ đang học, đã nhớ và tiến độ tổng thể.
4. Xem điểm quiz trung bình và tổng số lượt quiz đã nộp.
5. Xem tổng thời gian học hợp lệ đã ghi nhận trong phòng học.
6. Tiếp tục bộ thẻ vừa học gần nhất.
7. Xem tối đa 6 bộ thẻ cập nhật gần đây và 5 lượt quiz gần nhất.
8. Đi tới thư viện, tạo bộ thẻ, làm quiz hoặc mở phòng học.
9. Xem chuỗi ngày học hiện tại và chuỗi dài nhất theo giờ Việt Nam.
10. Tải avatar lên Cloudinary.
11. Tải ảnh cover cho deck để hiển thị trên Dashboard và thư viện.

Ngoài phạm vi MVP:

- Dashboard quản trị toàn hệ thống.
- Heatmap, goal, badge hoặc activity scoring.
- Upload video, audio, PDF hay tài liệu học tập.
- Cloudinary Upload Widget và **unsigned** upload preset.
- Đồng bộ ảnh từ Cloudinary về MongoDB bằng webhook.
- Kho thống kê riêng hoặc pipeline ETL.

Các phần ngoài phạm vi chỉ được thêm sau khi Dashboard MVP đã có số liệu đúng và test hiệu năng đạt.

## 3. Trạng thái hiện tại

### 3.1 Những gì đã có

- Frontend mẫu `Dashboard.tsx` đang gọi song song `/decks` và `/folders`, sau đó tự tính tổng số thẻ.
- Các model `Deck`, `Folder`, `Flashcard`, `CardProgress`, `QuizAttempt`, `RoomParticipant` và `StudyActivity` đã có dữ liệu nền cho Dashboard MVP.
- Backend đã có `GET /api/v1/dashboard` và tính study streak từ lịch sử `StudyActivity`.
- `User` đã có `avatarUrl`.
- `.env.example`, README và `env.config.js` đã có `CLOUD_NAME`, `API_KEY`, `API_SECRET`.
- API hồ sơ đã có `GET /users/me` và `PUT /users/me`.

### 3.2 Những gì còn thiếu hoặc chưa an toàn

- Frontend chưa chuyển hoàn toàn sang `/dashboard` và vẫn còn chỗ tự tổng hợp dữ liệu.
- Chưa có package `cloudinary` và chưa có file config/service cho Cloudinary.
- `PUT /users/me` đang cho client gửi một `avatarUrl` bất kỳ. Backend không biết URL đó có thực sự thuộc Cloudinary của HITProduct hay không.
- `User` chưa lưu `publicId` và `version`, nên không thể xóa hoặc thay ảnh Cloudinary một cách đáng tin cậy.
- `Deck` chưa có metadata ảnh cover.
- Một số index phục vụ Dashboard chưa tồn tại.
- Tài liệu Dashboard cũ đếm `new` trực tiếp từ `CardProgress`. Cách đó không đúng nếu thẻ chưa học chưa có document progress.
- Danh sách "gần đây" trong frontend hiện lấy phần tử đầu của `/decks`, nhưng route không cam kết đó là deck vừa học gần nhất.

### 3.3 Quyết định chuyển đổi

- Backend là nơi duy nhất tính số liệu Dashboard.
- Frontend gọi một endpoint `GET /api/v1/dashboard` cho dữ liệu chính.
- MongoDB là nguồn sự thật; MVP chưa cache Dashboard trong Redis.
- File ảnh đi trực tiếp từ browser đến Cloudinary bằng signed upload. API server chỉ tạo chữ ký và xác nhận kết quả.
- `API_SECRET` chỉ tồn tại ở backend; không được trả về response, log hoặc bundle frontend.
- Dùng signed upload preset do HITProduct quản lý để Cloudinary tự chặn format, dung lượng và kích thước không hợp lệ.
- Client không được tự ghi `avatarUrl` hoặc `coverUrl` qua API update thông thường.

## 4. Kiến trúc tối thiểu

```text
React Dashboard
  |
  | GET /api/v1/dashboard
  v
Express dashboard.controller
  v
dashboard.service
  |-- Deck / Folder / Flashcard
  |-- CardProgress / QuizAttempt
  |-- RoomParticipant
  `-- StudyActivity
          |
          `-------------> MongoDB

React upload ảnh
  |
  | POST /api/v1/media/upload-signature
  v
Express media.service -- ký tham số bằng API_SECRET
  |
  | signature + timestamp + tham số đã khóa
  v
Browser -- file ảnh --> Cloudinary Upload API
  |
  | public_id + version + secure_url + response signature
  v
Express confirm endpoint -- xác minh response signature
  |
  `-------------> MongoDB lưu metadata ảnh
```

Phân vai:

- **MongoDB** giữ số liệu học tập và metadata ảnh đã xác nhận.
- **Express** xác thực user, chốt phạm vi truy vấn, ký upload và xác minh kết quả Cloudinary.
- **Cloudinary** lưu, biến đổi và phân phối ảnh qua CDN.
- **React** hiển thị Dashboard và gửi file trực tiếp đến Cloudinary; không giữ bí mật Cloudinary.
- **Redis** chưa cần cho Dashboard MVP. Chỉ thêm cache khi có số đo chứng minh truy vấn MongoDB là nút thắt.

## 5. Nguồn sự thật và định nghĩa chỉ số

| Dữ liệu                  | Nguồn sự thật                         | Quy tắc                                                      |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------ |
| Tổng deck                | `Deck`                                | `ownerId = userId`                                           |
| Tổng folder              | `Folder`                              | `ownerId = userId`                                           |
| Tổng số thẻ              | `Deck.cardCount`                      | Chỉ cộng deck trong thư viện của user                        |
| Đang học / đã nhớ        | `CardProgress` + `Flashcard` + `Deck` | Progress phải thuộc thẻ trong thư viện của user              |
| Thẻ mới                  | Số học được suy ra                    | `max(totalCards - learning - remembered, 0)`                 |
| Điểm quiz trung bình     | `QuizAttempt`                         | Chỉ attempt có `submittedAt != null`                         |
| Tổng thời gian phòng học | `RoomParticipant.studySeconds`        | Cộng theo `userId` trên mọi room                             |
| Chuỗi ngày học           | `StudyActivity.dateKey`               | Một document/user/ngày, timezone `Asia/Ho_Chi_Minh`          |
| Deck vừa học             | `CardProgress.lastReviewedAt`         | Join qua `Flashcard.deckId`; fallback deck cập nhật gần nhất |
| Deck cập nhật gần đây    | `Deck.updatedAt`                      | Không được gọi nhầm là "vừa học"                             |
| Avatar / cover           | MongoDB metadata đã xác nhận          | URL phải khớp upload response hợp lệ từ Cloudinary           |

### 5.1 Invariant về tiến độ

Tử số và mẫu số phải dùng cùng một phạm vi deck. Không được:

- lấy `totalCards` từ deck do user sở hữu;
- nhưng lại đếm toàn bộ `CardProgress` của user, bao gồm thẻ public chưa copy hoặc dữ liệu mồ côi.

Công thức:

```text
studiedCards = learningCards + rememberedCards
newCards = max(totalCards - studiedCards, 0)
overallProgressPercent = totalCards == 0
  ? 0
  : round(rememberedCards / totalCards * 100)
```

Kết quả phải thỏa:

```text
0 <= rememberedCards <= studiedCards <= totalCards
0 <= overallProgressPercent <= 100
```

Nếu dữ liệu cũ làm bất biến trên sai, service phải chặn kết quả ra ngoài giới hạn và log cảnh báo để sau đó dọn dữ liệu mồ côi.

### 5.2 Empty state

User mới vẫn nhận `200 OK`:

- mọi số là `0`;
- mọi danh sách là `[]`;
- `continueLearning` là `null`;
- `studyStreak.currentDays` và `studyStreak.longestDays` là `0`;
- `studyStreak.lastStudyDate` là `null`;
- `profile.avatarUrl` có thể là `null`;
- không ném `404` chỉ vì chưa có deck hoặc attempt.

## 6. REST contract chung

Tất cả route bên dưới dùng prefix `/api/v1` và cần:

```http
Authorization: Bearer <accessToken>
```

| Method   | Path                      | Trách nhiệm                                  |
| -------- | ------------------------- | -------------------------------------------- |
| `GET`    | `/dashboard`              | Trả toàn bộ dữ liệu Dashboard cá nhân        |
| `POST`   | `/media/upload-signature` | Tạo signed upload cho avatar hoặc cover deck |
| `PUT`    | `/users/me/avatar`        | Xác nhận upload và lưu avatar                |
| `DELETE` | `/users/me/avatar`        | Xóa avatar Cloudinary và metadata            |
| `PUT`    | `/decks/:id/cover`        | Xác nhận upload và lưu cover deck            |
| `DELETE` | `/decks/:id/cover`        | Xóa cover nếu user là owner                  |

Không dùng `PUT /users/me` để cập nhật `avatarUrl`. Route đó chỉ còn nhận `displayName` và `defaultQuizSize`.

## 7. Contract `GET /api/v1/dashboard`

### 7.1 Response thành công

```json
{
  "statusCode": 200,
  "message": "Lấy tổng quan học tập thành công.",
  "data": {
    "profile": {
      "displayName": "An Nguyễn",
      "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v123/hitproduct/users/66/avatar.webp"
    },
    "stats": {
      "totalDecks": 4,
      "totalFolders": 2,
      "totalCards": 120,
      "studiedCards": 75,
      "rememberedCards": 48,
      "averageQuizScore": 82,
      "totalQuizAttempts": 9,
      "totalStudySeconds": 15600,
      "overallProgressPercent": 40
    },
    "studyStreak": {
      "currentDays": 6,
      "longestDays": 18,
      "lastStudyDate": "2026-07-29",
      "timezone": "Asia/Ho_Chi_Minh"
    },
    "progress": {
      "new": 45,
      "learning": 27,
      "remembered": 48
    },
    "continueLearning": {
      "deckId": "66a...",
      "title": "Từ vựng Unit 1",
      "description": "Từ vựng cơ bản",
      "cardCount": 30,
      "coverUrl": null,
      "lastStudiedAt": "2026-07-21T14:00:00.000Z"
    },
    "recentDecks": [],
    "recentQuizAttempts": []
  }
}
```

### 7.2 Shape của deck gần đây

```json
{
  "id": "66a...",
  "title": "Từ vựng Unit 1",
  "description": "Từ vựng cơ bản",
  "cardCount": 30,
  "visibility": "private",
  "coverUrl": null,
  "updatedAt": "2026-07-21T13:30:00.000Z"
}
```

Chỉ trả field frontend cần. Không trả nguyên Mongoose document, `__v`, `ownerId` hoặc metadata Cloudinary nội bộ.

### 7.3 Shape của quiz gần đây

```json
{
  "id": "77b...",
  "deck": {
    "id": "66a...",
    "title": "Từ vựng Unit 1"
  },
  "score": 90,
  "correctCount": 9,
  "totalQuestions": 10,
  "submittedAt": "2026-07-21T15:00:00.000Z"
}
```

Nếu deck đã bị xóa, `deck` là `null`; frontend hiển thị "Bộ thẻ đã xóa" và vẫn giữ lịch sử điểm.

### 7.4 Quy tắc study streak

- Một ngày được tính là đã học khi có ít nhất một hoạt động hợp lệ: review thẻ, trả lời trong learn session, nộp quiz hoặc phát sinh thời gian học hợp lệ trong phòng học.
- Ngày được cắt theo timezone `Asia/Ho_Chi_Minh`, không cắt theo UTC.
- `currentDays` là chuỗi liên tiếp kết thúc ở hôm nay hoặc hôm qua. Nếu ngày học gần nhất cũ hơn hôm qua thì giá trị bằng `0`.
- `longestDays` là chuỗi liên tiếp dài nhất trong toàn bộ lịch sử.
- Nhiều hoạt động trong cùng ngày chỉ tạo một ngày học.
- Không suy ra lịch sử streak từ `CardProgress.lastReviewedAt` vì lần review mới sẽ ghi đè thời điểm cũ.
- Chỉ gọi `recordStudyActivity` sau khi hoạt động học chính đã được lưu thành công.

## 8. Luồng Cloudinary đã chốt

### 8.1 Vì sao dùng signed direct upload

- File không đi qua API server nên giảm RAM, băng thông và thời gian xử lý của Express.
- Backend vẫn kiểm soát `public_id`, định dạng, kích thước và mục đích upload.
- `API_SECRET` không bao giờ xuất hiện ở frontend.
- Response từ Cloudinary được xác minh trước khi URL được ghi vào MongoDB.

Không dùng unsigned upload preset cho MVP vì preset public khó ràng buộc chặt asset nào thuộc user và deck nào.

Tạo hai **signed upload preset** trong Cloudinary Console:

| Preset                  | Mục đích    | Ràng buộc chính                                                                        |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `hitproduct_avatar`     | Avatar user | Image, tối đa 5 MB, `jpg/jpeg/png/webp/avif`, incoming transform giới hạn 1024 x 1024  |
| `hitproduct_deck_cover` | Cover deck  | Image, tối đa 10 MB, `jpg/jpeg/png/webp/avif`, incoming transform giới hạn 1600 x 1600 |

Tên preset được cấu hình qua biến môi trường backend. Client không được tự chọn preset. Signed preset giúp Cloudinary từ chối file quá giới hạn trước khi asset được chấp nhận; kiểm tra ở client và bước confirm vẫn được giữ như lớp bảo vệ bổ sung.

```env
CLOUDINARY_AVATAR_UPLOAD_PRESET=hitproduct_avatar
CLOUDINARY_DECK_COVER_UPLOAD_PRESET=hitproduct_deck_cover
```

Cập nhật đồng thời `.env.example` và `src/configs/env.config.js`. Không đặt giá trị mặc định production cho hai biến này.

### 8.2 Upload avatar

```text
1. Client chọn ảnh và kiểm tra sơ bộ MIME/size.
2. POST /media/upload-signature { purpose: "avatar" }.
3. Backend tạo public_id cố định:
   hitproduct/users/<userId>/avatar
4. Backend ký đúng tập tham số upload và trả signature.
5. Browser POST multipart/form-data trực tiếp tới Cloudinary.
6. Cloudinary trả public_id, version, secure_url, signature, width, height, format, bytes.
7. Client PUT /users/me/avatar với các field trên.
8. Backend xác minh:
   - public_id đúng tuyệt đối với user hiện tại;
   - response signature khớp public_id + version;
   - resource_type là image;
   - format, kích thước và bytes trong giới hạn;
   - URL là HTTPS và thuộc cloud name đã cấu hình.
9. Backend lưu metadata rồi trả profile mới.
10. React Query cập nhật cache user và Dashboard.
```

Dùng `public_id` cố định và `overwrite: true` để mỗi user chỉ có một avatar hiện hành. URL lưu trong DB phải có `version` để tránh CDN trả ảnh cũ.

### 8.3 Upload cover deck

Luồng giống avatar nhưng trước khi ký và xác nhận phải kiểm tra:

- deck tồn tại;
- `deck.ownerId` bằng user hiện tại;
- `public_id` đúng dạng `hitproduct/users/<userId>/decks/<deckId>/cover`.

Không nhận `public_id` do client tự đặt.

### 8.4 Request tạo chữ ký

```json
{
  "purpose": "deck-cover",
  "deckId": "66a..."
}
```

Response:

```json
{
  "statusCode": 200,
  "message": "Tạo chữ ký upload thành công.",
  "data": {
    "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud_name>/image/upload",
    "cloudName": "<cloud_name>",
    "apiKey": "<api_key>",
    "timestamp": 1784682000,
    "signature": "<signature>",
    "params": {
      "upload_preset": "hitproduct_deck_cover",
      "public_id": "hitproduct/users/66u/decks/66a/cover",
      "overwrite": true,
      "invalidate": true
    }
  }
}
```

Các giới hạn format, dung lượng và incoming transformation nằm trong signed preset. Client phải gửi nguyên vẹn `timestamp` cùng toàn bộ `params` đã được ký. Nếu thêm, bớt hoặc đổi một tham số có tham gia chữ ký, Cloudinary phải từ chối request.

### 8.5 Payload xác nhận ảnh

```json
{
  "publicId": "hitproduct/users/66u/avatar",
  "version": 1784682012,
  "secureUrl": "https://res.cloudinary.com/demo/image/upload/v1784682012/hitproduct/users/66u/avatar.webp",
  "signature": "<cloudinary-response-signature>",
  "assetId": "<asset-id>",
  "resourceType": "image",
  "format": "webp",
  "width": 800,
  "height": 800,
  "bytes": 162340
}
```

Backend tạo lại response signature bằng:

```js
cloudinary.utils.api_sign_request({ public_id: payload.publicId, version: payload.version }, env.cloudinary.apiSecret)
```

Sau đó so sánh bằng phép so sánh an toàn theo thời gian. Không tin riêng `secureUrl`, vì URL là dữ liệu client có thể sửa.

### 8.6 Xóa ảnh

- Backend đọc `publicId` từ MongoDB, không nhận target tùy ý từ client.
- Gọi `cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })`.
- Chỉ xóa metadata DB khi Cloudinary trả `ok` hoặc `not found`.
- Nếu Cloudinary lỗi tạm thời, giữ metadata và trả lỗi có thể retry; không để DB nói đã xóa trong khi asset vẫn còn.
- Nếu avatar hiện tại là URL Google OAuth và không có `avatarPublicId`, chỉ clear metadata avatar trong MongoDB; không gọi Cloudinary destroy.

## 9. Thay đổi dữ liệu và index

### 9.1 `User`

Giữ `avatarUrl` để tương thích response hiện tại và bổ sung:

```js
avatarPublicId: { type: String, default: null },
avatarAssetId: { type: String, default: null },
avatarVersion: { type: Number, default: null },
avatarFormat: { type: String, default: null }
```

Avatar từ Google OAuth có thể chỉ có `avatarUrl`; các field Cloudinary để `null`. Khi user upload avatar mới, Cloudinary trở thành nguồn ảnh hiện hành.

### 9.2 `Deck`

```js
coverUrl: { type: String, default: null },
coverPublicId: { type: String, default: null },
coverAssetId: { type: String, default: null },
coverVersion: { type: Number, default: null },
coverFormat: { type: String, default: null }
```

Không lưu transformation URL riêng. Frontend hoặc backend tạo delivery URL từ `publicId`/`version` theo preset hiển thị.

### 9.3 `StudyActivity`

Mỗi user có tối đa một document cho một ngày học:

```js
{
  userId,
  dateKey, // YYYY-MM-DD theo Asia/Ho_Chi_Minh
  timezone,
  firstActivityAt,
  lastActivityAt,
  sources
}
```

Unique index `{ userId: 1, dateKey: 1 }` bảo đảm retry không tạo ngày trùng. Nếu hai upsert đầu tiên chạy đồng thời và một request nhận `E11000`, request đó retry một lần bằng update thường trên cùng `{ userId, dateKey }`.

### 9.4 Index cần có

```js
deckSchema.index({ ownerId: 1, updatedAt: -1 })
folderSchema.index({ ownerId: 1 })
cardProgressSchema.index({ userId: 1, status: 1, lastReviewedAt: -1 })
quizAttemptSchema.index({ userId: 1, submittedAt: -1 })
roomParticipantSchema.index({ userId: 1, joinedAt: -1 })
studyActivitySchema.index({ userId: 1, dateKey: 1 }, { unique: true })
```

Không tạo index trùng với index đã có. Trước khi thêm, dùng `getIndexes()` hoặc MongoDB Compass kiểm tra tên và key thực tế.

## 10. File map toàn tính năng

### Backend

| File                                             | Trách nhiệm                                       |
| ------------------------------------------------ | ------------------------------------------------- |
| `src/constants/dashboard.constant.js`            | Limit danh sách và ngưỡng Dashboard               |
| `src/constants/media.constant.js`                | Purpose, format, byte/pixel limit, transformation |
| `src/configs/cloudinary.config.js`               | Khởi tạo Cloudinary SDK một lần                   |
| `src/models/user.model.js`                       | Metadata avatar                                   |
| `src/models/deck.model.js`                       | Metadata cover và index deck gần đây              |
| `src/models/cardProgress.model.js`               | Index progress Dashboard                          |
| `src/models/quizAttempt.model.js`                | Index quiz gần đây                                |
| `src/models/roomParticipant.model.js`            | Index tổng thời gian user                         |
| `src/models/studyActivity.model.js`               | Một document cho mỗi user/ngày học                |
| `src/validations/client/dashboard.validation.js` | Query Dashboard nếu sau này có range              |
| `src/validations/client/media.validation.js`     | Validate purpose, deckId và confirm payload       |
| `src/services/client/dashboard.service.js`       | Aggregate và map response                         |
| `src/services/client/studyActivity.service.js`   | Ghi ngày học và tính current/longest streak       |
| `src/services/client/media.service.js`           | Ký, xác minh và xóa asset Cloudinary              |
| `src/services/client/user.service.js`            | Xác nhận/xóa avatar                               |
| `src/services/client/deck.service.js`            | Xác nhận/xóa cover có owner guard                 |
| `src/controllers/client/dashboard.controller.js` | REST adapter Dashboard                            |
| `src/controllers/client/media.controller.js`     | REST adapter tạo chữ ký                           |
| `src/routers/client/dashboard.route.js`          | `GET /dashboard`                                  |
| `src/routers/client/media.route.js`              | `POST /media/upload-signature`                    |
| `src/routers/client/user.route.js`               | Avatar confirm/delete                             |
| `src/routers/client/deck.route.js`               | Cover confirm/delete                              |

Khi tạo file mới, cập nhật các barrel `index.js` tương ứng và mount router trong `src/routers/client/index.js`.

### Frontend

| File                                         | Trách nhiệm                               |
| -------------------------------------------- | ----------------------------------------- |
| `src/features/dashboard/api.ts`              | Gọi `GET /dashboard`                      |
| `src/features/dashboard/types.ts`            | Type contract Dashboard                   |
| `src/features/dashboard/Dashboard.tsx`       | Render màn tổng quan                      |
| `src/features/media/api.ts`                  | Xin signature, upload Cloudinary, confirm |
| `src/features/profile/AvatarUploader.tsx`    | Preview, progress, retry avatar           |
| `src/features/library/DeckCoverUploader.tsx` | Upload/xóa cover                          |
| `src/shared/api/queryKeys.ts`                | Key cache user/dashboard/deck             |

Tên file frontend có thể điều chỉnh theo repository frontend thật, nhưng trách nhiệm không được trộn vào một component lớn.

## 11. Kế hoạch triển khai theo phase

### Phase 1 - Contract, schema và index

Mục tiêu: khóa response và chuẩn bị truy vấn trước khi viết UI.

1. Tạo constant Dashboard/media.
2. Bổ sung metadata ảnh vào `User` và `Deck`.
3. Bổ sung index, không xóa index hiện tại.
4. Cập nhật Joi:
   - bỏ `avatarUrl` khỏi `updateProfile`;
   - validate `purpose` bằng enum;
   - `deckId` bắt buộc với `deck-cover`;
   - field confirm có giới hạn kiểu và độ dài.
5. Viết contract test cho empty state và response có dữ liệu.

Tiêu chí hoàn thành:

- model load không lỗi;
- index definition đúng;
- payload lạ bị loại;
- response contract được chốt bằng test.

### Phase 2 - Dashboard backend

Mục tiêu: frontend chỉ cần một request.

1. Tạo `dashboard.service.js`.
2. Ép `userId` sang `mongoose.Types.ObjectId` trước mọi pipeline `aggregate`; Mongoose aggregate không tự cast `$match` như query thông thường.
3. Chạy các truy vấn độc lập bằng `Promise.all`.
4. Giới hạn `recentDecks = 6`, `recentQuizAttempts = 5`.
5. Chỉ select/project field cần dùng.
6. Tính `new` từ tổng số thẻ, không từ document progress.
7. Tính streak từ `StudyActivity.dateKey` theo `Asia/Ho_Chi_Minh`.
8. Tạo controller, route và mount `/dashboard`.

Nên tách helper thuần để test:

```js
normalizeProgress({ totalCards, learning, remembered })
mapRecentDeck(deck)
mapRecentAttempt(attempt)
calculateStudyStreak(dateKeys, todayKey)
```

Tiêu chí hoàn thành:

- user mới nhận empty state chuẩn;
- không lẫn dữ liệu giữa hai user;
- progress luôn nằm trong giới hạn;
- deck vừa học ưu tiên `lastReviewedAt`, không nhầm với `updatedAt`;
- một attempt có deck bị xóa không làm endpoint lỗi.
- học hôm qua nhưng chưa học hôm nay vẫn giữ current streak;
- nhiều hoạt động cùng ngày không tạo document trùng.

### Phase 3 - Cloudinary backend

Mục tiêu: upload an toàn mà không chuyển file qua Express.

1. Cài dependency `cloudinary` với phiên bản cố định trong lockfile.
2. Tạo config đọc từ `env.cloudinary` và fail fast khi feature được bật nhưng thiếu biến môi trường.
3. Tạo hai signed upload preset trong Cloudinary Console và cấu hình tên preset ở backend.
4. Tạo allowlist tham số upload ở server; không nhận preset từ client.
5. Tạo route xin signature có auth và rate limit.
6. Xác minh quyền sở hữu deck trước khi ký cover.
7. Tạo hàm verify response signature.
8. Tạo confirm/delete avatar và cover.
9. Không log file, chữ ký, API secret hoặc toàn bộ payload Cloudinary.

Tiêu chí hoàn thành:

- frontend không có `API_SECRET`;
- user A không xin hoặc confirm cover cho deck của user B;
- đổi `publicId`, `version` hoặc `signature` làm request thất bại;
- xóa asset dùng public ID đọc từ DB;
- Google avatar cũ vẫn hiển thị được.

### Phase 4 - Frontend Dashboard và upload

Mục tiêu: thay dữ liệu demo/multi-request bằng contract thật.

1. Thay `useQueries(['/decks', '/folders'])` bằng một query `/dashboard`.
2. Render:
   - lời chào;
   - rail tiếp tục học;
   - stat cards;
   - tiến độ;
   - deck gần đây;
   - quiz gần đây;
   - CTA phòng học.
3. Empty state có CTA tạo deck, import thẻ và tìm deck public.
4. Upload ảnh:
   - validate trước ở client để phản hồi nhanh;
   - xin chữ ký mới cho mỗi lần upload;
   - upload bằng `FormData` trực tiếp đến `uploadUrl`;
   - confirm về backend;
   - chỉ cập nhật preview chính thức sau confirm thành công.
5. Sau confirm, invalidate/update các query `me`, `dashboard`, `deck` liên quan.

Nếu Cloudinary upload thành công nhưng confirm thất bại, hiển thị nút `Thử lưu lại`. Không tự xin signature và upload file lần hai ngay, vì sẽ tạo request thừa.

### Phase 5 - Test, observability và rollout

Mục tiêu: chứng minh số liệu đúng, upload an toàn và có thể vận hành.

1. Unit test helper và signature verification.
2. Service test từng truy vấn với user khác nhau.
3. API integration test auth, validation và owner guard.
4. Browser test loading/empty/error/upload/retry.
5. Đo thời gian `GET /dashboard` trên bộ dữ liệu lớn đại diện.
6. Thêm structured log và metric.
7. Rollout sau feature flag nếu frontend và backend phát hành khác thời điểm.

## 12. Bảo mật và xử lý lỗi

### 12.1 Bảo mật bắt buộc

- Không trả hoặc log `API_SECRET`.
- Chỉ backend được tạo chữ ký.
- Không ký object tham số do client gửi nguyên xi; server tự dựng allowlist.
- Không nhận tên upload preset từ client; backend chọn preset theo `purpose`.
- Signed preset phải giới hạn `allowed_formats`, `max_file_size` và incoming transformation.
- Signature endpoint cần auth và rate limit, ví dụ 10 lần/phút/user.
- Chỉ chấp nhận ảnh với allowlist format.
- Giới hạn avatar 5 MB, cover 10 MB; giới hạn chiều ảnh sau incoming transformation.
- Public ID phải được dựng từ authenticated `userId` và `deckId` đã kiểm tra quyền.
- Dùng HTTPS cho upload và delivery URL.
- Không lưu `url` HTTP khi Cloudinary đã trả `secure_url`.
- Không cho `PUT /users/me` ghi arbitrary URL vào avatar.

### 12.2 Thứ tự ghi dữ liệu

Upload và confirm là hai bước. Nếu upload thành công nhưng app đóng trước confirm, có thể tồn tại asset chưa được DB tham chiếu. Với public ID cố định, lần upload sau sẽ overwrite asset đó nên không tăng asset rác vô hạn.

Khi xóa:

```text
Cloudinary destroy thành công/not found
→ clear metadata MongoDB
→ invalidate cache frontend
```

Không clear DB trước rồi mới gọi Cloudinary.

### 12.3 Lỗi Dashboard

- MongoDB lỗi: trả lỗi chuẩn qua error middleware; không trả số `0` giả như thể dữ liệu thật rỗng.
- Một pipeline logic ra số âm/vượt tổng: clamp response và log invariant violation.
- `populate` deck quiz trả `null`: map an toàn.
- Cloudinary chưa cấu hình: Dashboard vẫn hoạt động; chỉ endpoint media trả lỗi cấu hình rõ ràng.

## 13. Hiệu năng và mở rộng

MVP tính trực tiếp từ MongoDB để số liệu luôn mới. Chỉ thêm cache khi đã đo.

Nguyên tắc:

- `Promise.all` chỉ dùng cho truy vấn độc lập.
- Mỗi query phải có giới hạn và projection.
- Không load toàn bộ flashcard hoặc progress vào Node.js để đếm.
- Dùng aggregation trong MongoDB và index đúng trường match/sort.
- Không dùng `populate` trong vòng lặp.
- Mục tiêu ban đầu: p95 của `GET /dashboard` dưới 500 ms ở dữ liệu đại diện.

Nếu cần cache sau này:

```text
key: dashboard:v1:<userId>
TTL: 30-60 giây
invalidate: review card, submit quiz, create/update/delete/copy deck,
            room study settlement, avatar/cover confirm
```

Không cache chung response cá nhân giữa nhiều user.

Khi dữ liệu đủ lớn và aggregation trở thành nút thắt, mới cân nhắc `UserDailyStat` hoặc `DashboardSnapshot`. Đây không phải yêu cầu MVP.

## 14. Kiểm thử bắt buộc

### 14.1 Dashboard

- [ ] User chưa có dữ liệu nhận toàn bộ số `0`, mảng rỗng và `continueLearning = null`.
- [ ] Hai user có dữ liệu khác nhau không bị lẫn.
- [ ] Thẻ chưa có `CardProgress` được tính là `new`.
- [ ] Progress mồ côi không làm `studiedCards > totalCards`.
- [ ] Chỉ attempt đã submit được tính điểm trung bình.
- [ ] Không có attempt thì average bằng `0`, không phải `NaN` hay `null`.
- [ ] Deck đã xóa không làm recent attempt lỗi.
- [ ] Tổng thời gian phòng học cộng đúng nhiều room.
- [ ] Học nhiều lần trong một ngày chỉ tăng một ngày streak.
- [ ] Học hôm qua nhưng chưa học hôm nay vẫn giữ current streak.
- [ ] Ngày học gần nhất cũ hơn hôm qua làm `currentDays = 0`.
- [ ] Qua 00:00 giờ Việt Nam tạo `dateKey` mới.
- [ ] Hai request đồng thời không tạo document `StudyActivity` trùng.
- [ ] User chưa từng học nhận `currentDays = 0`, `longestDays = 0`, `lastStudyDate = null`.
- [ ] `continueLearning` lấy deck có `lastReviewedAt` mới nhất.
- [ ] Fallback sang deck cập nhật gần nhất khi user chưa học thẻ nào.
- [ ] Route không auth trả `401`.

### 14.2 Cloudinary

- [ ] Thiếu `CLOUD_NAME`, `API_KEY` hoặc `API_SECRET` không làm server leak secret.
- [ ] Purpose không hợp lệ trả `400`.
- [ ] Client không thể tự chọn hoặc đổi upload preset.
- [ ] Signed preset từ chối file quá dung lượng hoặc sai format ngay tại Cloudinary.
- [ ] Xin cover signature cho deck người khác trả `403` hoặc `404` theo policy hiện tại.
- [ ] Signature ký đúng tập tham số.
- [ ] Public ID bị sửa bị từ chối khi confirm.
- [ ] Version hoặc response signature bị sửa bị từ chối.
- [ ] URL HTTP hoặc cloud name khác bị từ chối.
- [ ] File quá giới hạn hoặc sai format bị từ chối.
- [ ] Upload mới thay avatar/cover cũ đúng version.
- [ ] Delete gọi `destroy` đúng public ID và clear metadata sau thành công.
- [ ] Google OAuth avatar không có `publicId` vẫn xem được và xóa metadata cục bộ an toàn theo policy đã chốt.

### 14.3 Frontend

- [ ] Loading skeleton không nhảy layout lớn.
- [ ] Empty state có CTA dùng được.
- [ ] Lỗi Dashboard có retry.
- [ ] Ảnh được preview trước upload nhưng chỉ trở thành dữ liệu chính thức sau confirm.
- [ ] Upload có progress/disabled state và không submit lặp.
- [ ] Confirm lỗi có thể retry mà không upload lại file.
- [ ] Avatar/cover đổi xong cập nhật Dashboard không cần reload trang.
- [ ] Layout dùng được trên desktop và mobile.

## 15. Quan sát khi vận hành

Structured log cho Dashboard:

```text
event=dashboard.fetch userId durationMs result
event=dashboard.invariant_violation userId totalCards learning remembered
```

Structured log cho media:

```text
event=media.signature_created userId purpose deckId
event=media.confirmed userId purpose publicId version bytes format
event=media.destroyed userId purpose result
```

Không log `API_SECRET`, upload signature, response signature hoặc access token.

Theo dõi:

- p50/p95/p99 thời gian Dashboard;
- tỷ lệ lỗi Dashboard;
- số signature tạo ra so với số confirm thành công;
- lỗi confirm do signature/public ID;
- lỗi Cloudinary destroy;
- dung lượng ảnh trung bình và tỷ lệ format.

## 16. Definition of Done

- [ ] `GET /api/v1/dashboard` là nguồn dữ liệu duy nhất cho màn S03.
- [ ] Số deck, folder, card, progress, quiz và study time đúng theo cùng phạm vi user.
- [ ] Study streak đúng theo lịch sử `StudyActivity` và timezone `Asia/Ho_Chi_Minh`.
- [ ] Empty state trả `200` và render đúng.
- [ ] Frontend không còn tự tổng hợp Dashboard từ `/decks` và `/folders`.
- [ ] Avatar và deck cover upload trực tiếp đến Cloudinary bằng signed upload.
- [ ] `API_SECRET` không xuất hiện ở client, response hay log.
- [ ] Backend xác minh public ID, version và response signature trước khi ghi DB.
- [ ] User không thể sửa cover của deck người khác.
- [ ] Xóa ảnh đồng bộ Cloudinary và MongoDB đúng thứ tự.
- [ ] Tất cả index cần thiết đã được kiểm tra trên môi trường staging.
- [ ] Unit, integration và browser test bắt buộc đều đạt.
- [ ] p95 Dashboard đạt mục tiêu trên dữ liệu đại diện.
- [ ] README/API collection được cập nhật sau khi triển khai thực tế.

## 17. Nguồn tham khảo

Nguồn nội bộ:

- `.note/docs/study-rooms/README.md` - cấu trúc tài liệu canonical và Definition of Done.
- `.note/docs/api-dashboard.md` - thiết kế Dashboard cũ.
- `.note/import-test-fe/src/features/dashboard/Dashboard.tsx` - giao diện Dashboard mẫu hiện tại.
- `src/models/*.model.js` - schema đang chạy.
- `src/configs/env.config.js` và `.env.example` - biến môi trường Cloudinary hiện có.

Cloudinary chính thức:

- [Client-side uploading](https://cloudinary.com/documentation/client_side_uploading)
- [Generating authentication signatures](https://cloudinary.com/documentation/authentication_signatures)
- [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference)
- [Node.js image and video upload](https://cloudinary.com/documentation/node_image_and_video_upload)
- [Verifying response signatures](https://cloudinary.com/documentation/response_signatures)
- [Upload presets](https://cloudinary.com/documentation/upload_presets)

Khi code hoặc contract thay đổi, cập nhật trước các mục: **Trạng thái hiện tại**, **Nguồn sự thật**, **REST contract**, **File map** và **Definition of Done**.
