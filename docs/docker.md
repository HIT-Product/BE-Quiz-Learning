# Chạy HITProduct bằng Docker

Stack Docker gồm ba container: API, email worker và Redis local. API và worker dùng chung một image nhưng chạy thành hai process độc lập.

## Chuẩn bị

Tạo file môi trường từ mẫu và điền các secret còn thiếu:

```powershell
Copy-Item .env.example .env
```

Redis mặc định dùng mật khẩu `local-redis-password`. Khi deploy lên server, hãy đổi `REDIS_PASSWORD` trong `.env` thành một chuỗi mạnh.

`MONGO_URI` vẫn là nguồn cấu hình MongoDB:

- MongoDB Atlas: dùng URI Atlas bình thường.
- MongoDB chạy trên máy host: trong Docker, dùng `mongodb://host.docker.internal:27017/<database>` thay cho `localhost`.
- Linux server cũng dùng được `host.docker.internal` nhờ stack đã cấu hình `host-gateway`.

## Chỉ chạy Redis local

Nếu API và worker vẫn chạy trực tiếp bằng npm/PM2 trên máy host, chỉ khởi động Redis:

```bash
docker compose up -d redis
```

Khi đó giữ `REDIS_HOST=localhost`, `REDIS_PORT=6379` và cùng giá trị `REDIS_PASSWORD` trong `.env`.

## Khởi động

```bash
docker compose up -d --build
```

Kiểm tra trạng thái và log:

```bash
docker compose ps
docker compose logs -f api worker redis
```

Dừng container nhưng giữ dữ liệu Redis:

```bash
docker compose down
```

API chạy tại `http://localhost:3000`; Redis chỉ được mở tại `127.0.0.1:6379`, không public ra Internet.

## Giới hạn cho server nhỏ

| Service | RAM container |       V8 heap |  CPU |
| ------- | ------------: | ------------: | ---: |
| API     |        300 MB |        240 MB | 0.75 |
| Worker  |        150 MB |        112 MB | 0.35 |
| Redis   |        160 MB | 96 MB dữ liệu | 0.25 |

Redis dùng AOF `everysec` để giữ dữ liệu qua lần restart và policy `noeviction`, là policy an toàn cho BullMQ. Nếu Redis đầy, lệnh ghi sẽ báo lỗi thay vì âm thầm xóa job. Dữ liệu nằm trong named volume `hitproduct_redis_data`.

Docker log được xoay vòng, tối đa khoảng 30 MB mỗi container. Có thể tăng giới hạn RAM sau khi quan sát thực tế bằng `docker stats`.

## Chia sẻ image production

Build và push image:

```bash
docker login
docker build -t vanphuoc0443/hitproduct-api:latest .
docker push vanphuoc0443/hitproduct-api:latest
```

Máy nhận chỉ cần `compose.prod.yaml` và file `.env` riêng. Các biến tối thiểu cho Compose production:

```env
HITPRODUCT_IMAGE=vanphuoc0443/hitproduct-api:latest
REDIS_PASSWORD=replace-with-a-strong-password
MONGO_URI=mongodb+srv://user:password@cluster/database
```

Tải image và khởi động:

```bash
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d
docker compose -f compose.prod.yaml ps
```

Repository Docker Hub phải public, hoặc máy nhận phải chạy `docker login` trước. Không chia sẻ `.env` thật; chỉ chia sẻ `.env.example` và yêu cầu người nhận tự điền secret.
