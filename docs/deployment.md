# Backend deployment

Backend được deploy độc lập với frontend. Một bản production hoàn chỉnh gồm bốn thành phần:

| Thành phần | Lệnh/loại service | Số replica hiện tại |
| --- | --- | --- |
| API + Socket.IO | `npm run prod` | 1 |
| Email worker | `npm run prod:worker` | 1 |
| MongoDB | MongoDB Atlas hoặc container có volume | managed/1 |
| Redis | Redis managed qua `REDIS_URL` hoặc container có volume | managed/1 |

API và worker phải dùng cùng MongoDB, Redis và bộ biến môi trường. Không đưa file `.env` lên Git.

## Deploy trên PaaS

Tạo hai service từ cùng repository và cùng commit:

### Web/API service

- Build command: `npm ci --omit=dev`
- Start command: `npm run prod`
- Health check: `/health/ready`
- Port: dùng biến `PORT` do nền tảng cung cấp
- Host: `0.0.0.0`

### Background worker

- Build command: `npm ci --omit=dev`
- Start command: `npm run prod:worker`
- Không cần public port hoặc health HTTP

Giữ API ở một replica cho đến khi Socket.IO Redis adapter được bật. Nếu chạy nhiều API replica lúc này,
socket trong phòng học có thể không nhận đủ sự kiện giữa các instance.

## Biến môi trường production

Sao chép danh sách từ `.env.example`. Các biến bắt buộc khi `NODE_ENV=production`:

- `HOST=0.0.0.0`, `PORT` theo nền tảng và `CLIENT_URL` khi có frontend;
- `MONGO_URI`, hoặc đủ `MONGO_USERNAME` + `MONGO_PASSWORD` cho Docker Compose;
- `REDIS_URL`, hoặc `REDIS_HOST`, `REDIS_PORT`, username/password;
- `JWT_SECRET_LOGIN`, `JWT_SECRET_REFRESH`, thời hạn token và `OTP_PEPPER`;
- Google OAuth client ID, secret và callback URL;
- SMTP user/password, host, port và chế độ secure.

Ba giá trị `JWT_SECRET_LOGIN`, `JWT_SECRET_REFRESH`, `OTP_PEPPER` phải dài ít nhất 32 ký tự.
Tạo secret ngẫu nhiên thay vì dùng giá trị mẫu.

Khi frontend chưa có, backend vẫn dùng được qua Postman hoặc Swagger. Sau này đặt:

```env
CLIENT_URL=https://app.example.com
GOOGLE_CALLBACK_URL=https://api.example.com/api/v1/auth/google-callback
```

Callback URL phải được khai báo giống hệt trong Google Cloud Console.

## Deploy bằng Docker Compose

Build và chạy toàn bộ stack tại máy hiện tại:

```bash
docker compose up -d --build
docker compose ps
```

Production dùng image đã publish:

```bash
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d
docker compose -f compose.prod.yaml ps
```

Không xóa volume `mongo_data` hoặc `redis_data` khi cập nhật phiên bản.

## Kiểm tra sau deploy

1. `GET /health/live` trả `200`.
2. `GET /health/ready` trả `200` và cả Mongo/Redis là `true`.
3. Mở `/api-docs` và thử đăng nhập.
4. Kiểm tra worker đã kết nối Redis và không có job email lỗi liên tục.
5. Tạo hoặc chọn một tài khoản rồi nâng quyền admin:

```bash
npm run admin:promote -- admin@example.com
```

Trong Docker:

```bash
docker compose -f compose.prod.yaml run --rm --no-deps api npm run admin:promote -- admin@example.com
```

6. Đăng nhập tài khoản đó và gọi `GET /api/v1/admin/analytics?days=30`.

## Cập nhật phiên bản

Deploy cùng một commit cho API và worker. API xử lý `SIGTERM` bằng cách ngừng nhận request,
đóng Socket.IO/BullMQ/MongoDB/Redis rồi thoát. Server không drain hàng đợi khi khởi động lại,
vì vậy job đang chờ được giữ qua lần redeploy.
