# HITProduct Backend API

Backend API cho hệ thống Quiz Learning, xây dựng bằng Node.js, Express, MongoDB và Redis.

## Công nghệ chính

- Node.js và Express
- MongoDB/Mongoose
- Redis, BullMQ và worker xử lý email
- JWT, cookie HttpOnly và Google OAuth 2.0
- PM2 để quản lý API và worker trong môi trường production

## Yêu cầu hệ thống

- Node.js và npm
- MongoDB
- Redis
- PM2 (khi triển khai production)

## Cài đặt project

```bash
git clone https://github.com/HIT-Product/BE-Quiz-Learning.git
cd BE-Quiz-Learning
npm ci
```

Tạo file môi trường:

```bash
cp .env.example .env
```

Trên Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Điền đầy đủ giá trị trong `.env`:

```env
# Server
NODE_ENV=development
HOST=localhost
PORT=3000
CLIENT_URL=http://localhost:5173

# Database
MONGO_URI=mongodb://localhost:27017/quiz-learning

# Bcrypt
SALT_ROUNDS=10

# Email
EMAIL_USER=
EMAIL_PASS=

# JWT
JWT_SECRET_LOGIN=replace-with-a-long-random-secret
JWT_SECRET_OTP=replace-with-a-long-random-secret
JWT_SECRET_REFRESH=replace-with-a-long-random-secret
JWT_EXPIRESIN_LOGIN=15m
JWT_EXPIRESIN_OTP=5m
JWT_EXPIRESIN_REFRESH=7d
OTP_PEPPER=replace-with-a-long-random-pepper

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=

# Cloudinary
CLOUD_NAME=
API_KEY=
API_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google-callback
```

Google Cloud Console phải khai báo chính xác `GOOGLE_CALLBACK_URL` trong **Authorized redirect URIs**.

## Chạy ở môi trường phát triển

Khởi động API:

```bash
npm run dev
```

Mở terminal khác để khởi động email worker:

```bash
npm run dev:worker
```

Mặc định:

- Server: `http://localhost:3000`
- API base URL: `http://localhost:3000/api/v1`

## Chạy production bằng PM2

Project có sẵn [ecosystem.config.cjs](./ecosystem.config.cjs) để quản lý hai tiến trình:

- `api`: 2 instance chạy cluster
- `worker`: 2 instance chạy fork để xử lý hàng đợi email

Cài PM2 toàn cục:

```bash
npm install --global pm2
```

Đặt `NODE_ENV=production` và hoàn thiện file `.env`, sau đó khởi chạy:

```bash
pm2 start ecosystem.config.cjs
```

Kiểm tra trạng thái và log:

```bash
pm2 status
pm2 logs
```

Xem log riêng:

```bash
pm2 logs api
pm2 logs worker
```

### Các lệnh PM2 thường dùng

```bash
# Khởi động lại toàn bộ tiến trình
pm2 restart ecosystem.config.cjs

# Nạp lại API theo cơ chế zero-downtime
pm2 reload api

# Khởi động lại worker
pm2 restart worker

# Dừng toàn bộ tiến trình
pm2 stop ecosystem.config.cjs

# Xóa toàn bộ tiến trình khỏi PM2
pm2 delete ecosystem.config.cjs

# Theo dõi CPU và bộ nhớ
pm2 monit
```

Sau khi cập nhật code hoặc thay đổi biến môi trường:

```bash
git pull
npm ci
pm2 restart ecosystem.config.cjs --update-env
```

### Tự khởi động sau khi reboot

Trên Linux/macOS:

```bash
pm2 startup
pm2 save
```

Lệnh `pm2 startup` sẽ in ra một lệnh cần quyền quản trị. Chạy chính xác lệnh đó, sau đó chạy lại `pm2 save`.

Trên Windows, `pm2 startup` không được hỗ trợ trực tiếp như Linux/macOS. Hãy cấu hình PM2 bằng Task Scheduler hoặc startup service phù hợp.

## Quy ước xác thực cho Frontend

- Access token nằm trong `data.accessToken` của response.
- Gửi access token bằng header `Authorization: Bearer <accessToken>`.
- Refresh token được lưu trong cookie `HttpOnly`; không lưu refresh token vào localStorage.
- Request cần cookie phải bật `credentials: 'include'` hoặc Axios `withCredentials: true`.
- Khi API trả `401`, gọi refresh token một lần rồi thử lại request cũ.

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

## API hiện có

Tất cả endpoint bên dưới sử dụng prefix `/api/v1`. Những endpoint có xác thực Bearer token yêu cầu header `Authorization: Bearer <accessToken>`.

### Auth

Luong dang ky hien tai dung OTP email:

1. Goi `POST /auth/register` de gui OTP va luu pending registration.
2. Nguoi dung nhap OTP tu email.
3. Goi `POST /auth/register/verify-otp` de tao tai khoan, nhan `accessToken` va refresh token trong cookie HttpOnly.
4. Neu can gui lai OTP khi pending con han, goi `POST /auth/register/resend-otp`.

| Method | Endpoint | Xac thuc | Chuc nang |
| --- | --- | --- | --- |
| POST | `/auth/register` | Khong | Gui OTP dang ky, chua tao tai khoan |
| POST | `/auth/register/verify-otp` | Khong | Xac thuc OTP, tao tai khoan va dang nhap |
| POST | `/auth/register/resend-otp` | Khong | Gui lai OTP dang ky |
| POST | `/auth/login` | Khong | Dang nhap bang email va mat khau |
| GET | `/auth/google` | Khong | Bat dau Google OAuth |
| GET | `/auth/google-callback` | Google | Callback Google OAuth |
| POST | `/auth/refresh-token` | Refresh cookie | Lam moi access token |
| POST | `/auth/logout` | Refresh cookie | Dang xuat phien hien tai |
| POST | `/auth/logout-all` | Bearer token | Dang xuat moi thiet bi |
| POST | `/auth/change-password` | Bearer token | Doi mat khau |
| POST | `/auth/forgot-password` | Khong | Gui OTP khoi phuc mat khau |
| POST | `/auth/forgot-password/resend` | Khong | Gui lai OTP khoi phuc mat khau |
| POST | `/auth/reset-password` | Khong | Dat lai mat khau bang OTP |

### Users

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| GET | `/users/me` | Bearer token | Lấy hồ sơ hiện tại |
| PUT | `/users/me` | Bearer token | Cập nhật hồ sơ hiện tại |

### Folders

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| GET | `/folders` | Bearer token | Liệt kê thư mục của tôi |
| POST | `/folders` | Bearer token | Tạo thư mục |
| GET | `/folders/:id` | Bearer token | Chi tiết thư mục |
| PUT | `/folders/:id` | Bearer token | Đổi tên thư mục |
| DELETE | `/folders/:id` | Bearer token | Xóa thư mục |

### Decks

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| GET | `/decks` | Bearer token | Deck của tôi (lọc theo `?folderId=`) |
| GET | `/decks/public` | Bearer token | Deck công khai |
| POST | `/decks` | Bearer token | Tạo deck (có thể kèm `folderId`) |
| GET | `/decks/:id` | Bearer token | Chi tiết deck |
| PUT | `/decks/:id` | Bearer token | Cập nhật deck, xếp/chuyển/bỏ folder |
| DELETE | `/decks/:id` | Bearer token | Xóa deck (kéo theo flashcard) |
| POST | `/decks/:id/copy` | Bearer token | Sao chép deck công khai |

### Flashcards

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| GET | `/decks/:deckId/cards` | Bearer token | Liệt kê thẻ trong deck |
| POST | `/decks/:deckId/cards` | Bearer token | Thêm thẻ |
| PUT | `/decks/:deckId/cards/reorder` | Bearer token | Sắp xếp lại thứ tự thẻ |
| PUT | `/decks/:deckId/cards/:cardId` | Bearer token | Sửa thẻ |
| DELETE | `/decks/:deckId/cards/:cardId` | Bearer token | Xóa thẻ |

### Quiz — Chế độ Kiểm tra

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| POST | `/decks/:deckId/quiz` | Bearer token | Sinh đề quiz |
| POST | `/decks/:deckId/quiz/submit` | Bearer token | Nộp bài, chấm điểm và lưu kết quả |

### Study — Chế độ Lật thẻ

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| GET | `/decks/:deckId/study` | Bearer token | Lấy thẻ kèm trạng thái (`?filter=all\|new\|learning`) |
| POST | `/decks/:deckId/study/cards/:cardId/review` | Bearer token | Đánh dấu nhớ / chưa nhớ |

### Learn — Chế độ Học thích ứng

| Method | Endpoint | Xác thực | Chức năng |
| --- | --- | --- | --- |
| GET | `/decks/:deckId/learn` | Bearer token | Sinh vòng câu hỏi thích ứng |
| POST | `/decks/:deckId/learn/answer` | Bearer token | Chấm câu trả lời, cập nhật tiến độ |

## Ví dụ gọi API

```js
const apiUrl = 'http://localhost:3000/api/v1'

export async function login(email, password) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message)
  }

  return result.data.accessToken
}
```

## Postman

Import collection:

```text
postman/HIT-Product.collection.json
```

Cac bien chinh:

- `baseUrl`: `http://localhost:3000/api/v1`
- `accessToken`: tu luu sau khi xac thuc OTP dang ky hoac dang nhap
- `registerEmail`: email dung cho luong dang ky bang OTP
- `registerOtp`: OTP dang ky nhan qua email, can dien thu cong truoc khi goi request xac thuc
- `otp`: OTP nhan qua email de dat lai mat khau
- `folderId`, `deckId`, `cardId`: tu luu sau khi tao tuong ung
- Cookie jar cua Postman tu luu refresh token

Thu tu test nhanh trong Postman:

1. Chay `Gui OTP Xac Thuc Email Dang Ky`.
2. Lay OTP trong email va dien vao bien `registerOtp`.
3. Chay `Xac Thuc OTP Dang Ky` de tao tai khoan va luu `accessToken`.
4. Dung `Gui Lai OTP Xac Thuc Email Dang Ky` hoac `Gui Lai OTP Quen Mat Khau` khi can gui lai ma.

Google Login su dung OAuth redirect. Neu Postman khong tu theo redirect, mo URL trong header `Location` bang trinh duyet.
