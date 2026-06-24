# HITProduct Backend API

Backend cho hệ thống Quiz Learning, xây dựng bằng Express, MongoDB, Redis và JWT.

## Chạy dự án

Yêu cầu: Node.js, MongoDB và Redis.

```bash
npm install
npm run dev
```

Chạy email worker ở terminal khác:

```bash
npm run dev:worker
```

Backend mặc định chạy tại `http://localhost:3000`, API base URL là:

```text
http://localhost:3000/api/v1
```

## Cấu hình môi trường

Sao chép `.env.example` thành `.env` và điền các giá trị cần thiết:

```env
NODE_ENV=development
HOST=localhost
PORT=3000
CLIENT_URL=

MONGO_URI=mongodb://localhost:27017/quiz-learning
SALT_ROUNDS=10

JWT_SECRET_LOGIN=replace-with-a-long-random-secret
JWT_SECRET_OTP=replace-with-a-long-random-secret
JWT_SECRET_REFRESH=replace-with-a-long-random-secret
JWT_EXPIRESIN_LOGIN=15m
JWT_EXPIRESIN_OTP=5m
JWT_EXPIRESIN_REFRESH=7d

REDIS_HOST=localhost
REDIS_PORT=6379

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google-callback
```

Google Cloud Console phải khai báo chính xác `GOOGLE_CALLBACK_URL` trong **Authorized redirect URIs**.

## Quy ước xác thực cho Frontend

- Access token nằm trong `data.accessToken` của response.
- Frontend gửi access token bằng header `Authorization: Bearer <accessToken>`.
- Refresh token được Backend lưu trong cookie `HttpOnly`; không lưu refresh token vào localStorage.
- Request cần cookie phải bật `credentials: 'include'` hoặc Axios `withCredentials: true`.
- Khi API trả `401`, Frontend gọi refresh token một lần rồi thử lại request cũ.

Response thành công:

```json
{
  "statusCode": 200,
  "message": "Thông báo",
  "data": {}
}
```

Response lỗi:

```json
{
  "statusCode": 400,
  "message": "Nội dung lỗi"
}
```

## Danh sách API hiện có

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| POST | `/auth/register` | Không | Đăng ký tài khoản |
| POST | `/auth/login` | Không | Đăng nhập email/mật khẩu |
| GET | `/auth/google` | Không | Bắt đầu Google OAuth |
| GET | `/auth/google-callback` | Google | Callback Google đang cấu hình |
| GET | `/auth/google/callback` | Google | Callback Google dạng chuẩn |
| POST | `/auth/refresh-token` | Refresh cookie | Làm mới access token |
| POST | `/auth/logout` | Refresh cookie | Đăng xuất phiên hiện tại |
| POST | `/auth/logout-all` | Bearer token | Đăng xuất mọi thiết bị |
| POST | `/auth/change-password` | Bearer token | Đổi mật khẩu |
| POST | `/auth/forgot-password` | Không | Gửi OTP khôi phục mật khẩu |
| POST | `/auth/reset-password` | Không | Đặt lại mật khẩu bằng OTP |
| GET | `/users/me` | Bearer token | Lấy hồ sơ hiện tại |
| PUT | `/users/me` | Bearer token | Cập nhật hồ sơ hiện tại |

## Google Login

Mở URL sau bằng trình duyệt:

```text
http://localhost:3000/api/v1/auth/google
```

Khi chưa có Frontend, đăng nhập thành công trả trực tiếp:

```json
{
  "statusCode": 200,
  "message": "Đăng nhập Google thành công.",
  "data": {
    "accessToken": "<JWT>"
  }
}
```

Refresh token đồng thời được đặt vào cookie `HttpOnly`.

Khi có Frontend, tìm comment `FE TODO` trong `src/controllers/client/auth.controller.js` để thay response JSON bằng redirect tới trang xử lý đăng nhập. Các route dành cho FE được đánh dấu bằng comment `FE:` trong `src/routers/client/auth.route.js`.

## Đổi và khôi phục mật khẩu

Đổi mật khẩu:

```http
POST /api/v1/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "oldPassword": "old-password",
  "newPassword": "new-password",
  "logoutOtherDevices": true
}
```

Yêu cầu OTP:

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

Đặt lại mật khẩu:

```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "new-password"
}
```

Sau khi đặt lại mật khẩu, mọi session cũ của người dùng bị thu hồi.

## Hồ sơ người dùng

Lấy hồ sơ:

```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

Cập nhật hồ sơ:

```http
PUT /api/v1/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "displayName": "Tên mới",
  "avatarUrl": "https://example.com/avatar.png",
  "defaultQuizSize": 20
}
```

Chỉ các trường `displayName`, `avatarUrl` và `defaultQuizSize` được cập nhật.

## Ví dụ gọi API từ Frontend

```js
const apiUrl = 'http://localhost:3000/api/v1'

export async function login(email, password) {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  })

  const result = await res.json()
  if (!res.ok) throw new Error(result.message)
  return result.data.accessToken
}
```

## Postman

Import collection:

```text
postman/auth.collection.json
```

Collection sử dụng:

- `baseUrl`: `http://localhost:3000/api/v1`
- `accessToken`: tự lưu sau đăng ký hoặc đăng nhập
- Cookie jar của Postman: tự lưu refresh token
- `otp`: nhập OTP nhận được qua email trước khi chạy Reset Password

Google Login là OAuth redirect nên request Postman được cấu hình không tự theo redirect; hãy mở giá trị header `Location` trong trình duyệt để đăng nhập.