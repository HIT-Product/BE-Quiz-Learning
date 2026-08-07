# Tích hợp FE - Phòng học ảo

Tài liệu này là hướng dẫn triển khai frontend cho Study Room. Bám đúng thứ tự dưới đây. Không gọi `media-token` trước khi `room:join` thành công.

## 1. Cài package và cấu hình

```powershell
npm.cmd install socket.io-client livekit-client
```

```env
# Không thêm /api/v1 vào VITE_SOCKET_ORIGIN.
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_ORIGIN=http://localhost:3000
```

API REST dùng `VITE_API_BASE_URL`. Socket.IO namespace là `${VITE_SOCKET_ORIGIN}/study-rooms`.

## 2. Contract bắt buộc

Socket.IO xác thực qua `auth`, không phải HTTP header:

```ts
auth: {
  token: accessToken, // Chuỗi JWT, không kèm "Bearer "
  deviceId
}
```

REST xác thực qua header:

```http
Authorization: Bearer <accessToken>
x-device-id: <deviceId>
```

`deviceId` phải là cùng một giá trị ở hai nơi, dài 8-128 ký tự và giữ ổn định trên cùng trình duyệt. Không tạo lại khi component render hoặc refresh trang.

Mọi ack Socket.IO có dạng:

```ts
type SocketAck<T> =
  | { ok: true; data: T | null }
  | { ok: false; code: string; message: string }
```

## 3. Utility dùng lại

Tạo `src/features/study-room/realtime.ts` (điều chỉnh path theo project FE).

```ts
import { io, type Socket } from 'socket.io-client'

const SOCKET_ORIGIN = import.meta.env.VITE_SOCKET_ORIGIN
const DEVICE_ID_KEY = 'hit-study-room-device-id'

export type SocketAck<T> =
  | { ok: true; data: T | null }
  | { ok: false; code: string; message: string }

export function getStudyRoomDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export function createStudyRoomSocket(accessToken: string) {
  return io(`${SOCKET_ORIGIN}/study-rooms`, {
    autoConnect: false,
    auth: {
      token: accessToken,
      deviceId: getStudyRoomDeviceId()
    }
  })
}

export function emitAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 8_000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('SOCKET_TIMEOUT')), timeoutMs)

    socket.emit(event, payload, (ack: SocketAck<T>) => {
      window.clearTimeout(timer)
      if (ack?.ok) resolve(ack.data as T)
      else reject(Object.assign(new Error(ack?.message || 'SOCKET_ERROR'), { code: ack?.code }))
    })
  })
}

export function waitForSocketConnect(socket: Socket, timeoutMs = 8_000) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('SOCKET_CONNECT_TIMEOUT')), timeoutMs)
    socket.once('connect', () => {
      window.clearTimeout(timer)
      resolve()
    })
    socket.once('connect_error', (error) => {
      window.clearTimeout(timer)
      reject(error)
    })
    socket.connect()
  })
}
```

## 4. Flow vào phòng, Socket và LiveKit

### 4.1 Thứ tự bắt buộc

1. User tạo phòng (`POST /study-rooms`) hoặc nhập mã (`POST /study-rooms/join`).
2. FE điều hướng đến màn hình room với `roomId` nhận được.
3. Mở Socket.IO với `accessToken` và `deviceId`.
4. Chờ `connect`, emit `room:join`, chỉ tiếp tục khi ack có `ok: true`.
5. Dùng snapshot để dựng UI.
6. Gọi `POST /study-rooms/:id/media-token`, gửi `x-device-id` giống Socket.
7. Dùng `url` và `token` trả về để `LiveKit Room.connect()`.
8. Gửi `room:heartbeat` mỗi 25 giây trong lúc còn ở màn hình.

`POST /media-token` trước bước 4 sẽ nhận HTTP `409`. Đây là cơ chế bảo vệ token, không phải lỗi cần retry mù.

### 4.2 Kiểu dữ liệu tối thiểu

```ts
export type RoomSnapshot = {
  room: {
    _id: string
    hostId: string
    status: 'open' | 'closing' | 'closed'
    settings: {
      chatEnabled: boolean
      leaderboardEnabled: boolean
      cameraAllowed: boolean
      micAllowed: boolean
      screenShareAllowed: boolean
      micLocked: boolean
    }
  }
  onlineIds: string[]
  onlineUsers: Array<{ userId: { _id: string; displayName: string }; role: 'host' | 'member' }>
  pomodoro: unknown
  leaderboard: Array<{ userId: string; studySeconds: number }>
  recentMessages: unknown[]
  serverNow: number
  deviceGeneration: number
  tookOver: boolean
}

type MediaTokenResponse = {
  token: string
  url: string
  identity: string
}
```

### 4.3 Hàm join hoàn chỉnh

```ts
import axios from 'axios'
import { Room } from 'livekit-client'
import {
  createStudyRoomSocket,
  emitAck,
  getStudyRoomDeviceId,
  waitForSocketConnect,
  type RoomSnapshot
} from './realtime'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function joinStudyRoom(roomId: string, accessToken: string) {
  const socket = createStudyRoomSocket(accessToken)
  await waitForSocketConnect(socket)

  const snapshot = await emitAck<RoomSnapshot>(socket, 'room:join', { roomId })
  const deviceId = getStudyRoomDeviceId()

  const response = await axios.post<{ data: MediaTokenResponse }>(
    `${API_BASE_URL}/study-rooms/${roomId}/media-token`,
    null,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-device-id': deviceId
      }
    }
  )

  const livekit = new Room()
  await livekit.connect(response.data.data.url, response.data.data.token)

  return { socket, livekit, snapshot }
}
```

Nếu bước xin media token thất bại, gọi `socket.disconnect()` trước khi hiện lỗi. Không giữ socket sống khi đã không thể hoàn thành flow vào phòng.

## 5. Hook React tham khảo

Mỗi room chỉ có một socket và một `Room` LiveKit. Dùng `useRef`, không tạo socket trong render.

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Room } from 'livekit-client'
import type { Socket } from 'socket.io-client'
import { emitAck } from './realtime'
import { joinStudyRoom } from './joinStudyRoom'

export function useStudyRoom(roomId: string, accessToken: string, onRoomClosed: () => void) {
  const socketRef = useRef<Socket | null>(null)
  const livekitRef = useRef<Room | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const [snapshot, setSnapshot] = useState<unknown>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let disposed = false

    const cleanup = () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
      livekitRef.current?.disconnect()
      socketRef.current?.disconnect()
      livekitRef.current = null
      socketRef.current = null
    }

    const start = async () => {
      try {
        const session = await joinStudyRoom(roomId, accessToken)
        if (disposed) {
          session.livekit.disconnect()
          session.socket.disconnect()
          return
        }

        socketRef.current = session.socket
        livekitRef.current = session.livekit
        setSnapshot(session.snapshot)

        session.socket.on('room:closed', () => {
          cleanup()
          onRoomClosed()
        })
        session.socket.on('room:session-taken-over', cleanup)
        session.socket.on('room:kicked', cleanup)
        session.socket.on('room:banned', cleanup)

        heartbeatRef.current = window.setInterval(async () => {
          try {
            await emitAck(session.socket, 'room:heartbeat', { roomId }, 5_000)
          } catch {
            cleanup()
            setError(new Error('SESSION_TAKEN_OVER'))
          }
        }, 25_000)
      } catch (joinError) {
        if (!disposed) setError(joinError instanceof Error ? joinError : new Error('ROOM_JOIN_FAILED'))
        cleanup()
      }
    }

    start()
    return () => {
      disposed = true
      cleanup()
    }
  }, [roomId, accessToken, onRoomClosed])

  return { snapshot, error, socket: socketRef.current, livekit: livekitRef.current }
}
```

`onRoomClosed` cần điều hướng ra danh sách phòng hoặc trang lịch sử. Không cố reconnect khi nhận `room:closed`, `room:kicked`, `room:banned` hoặc `room:session-taken-over`.

## 6. Reconnect và refresh token

- Socket.IO tự reconnect được, nhưng sau event `connect` mới phải emit lại `room:join` rồi mới dùng media token.
- Khi access token được refresh, cập nhật `socket.auth.token` rồi reconnect; không tạo `deviceId` mới.
- Token LiveKit sống 10 phút. Trước khi hết hạn, gọi lại `POST /media-token` với đúng `x-device-id`, sau đó reconnect LiveKit với token mới nếu SDK/app cần duy trì media liên tục.
- Nếu REST trả `409`, dừng media và chạy lại flow Socket `connect` -> `room:join` -> `media-token`.
- Nếu REST trả `503`, LiveKit backend chưa sẵn sàng; giữ UI room realtime nhưng hiển thị audio/video unavailable và cho user bấm thử lại.

## 7. Đóng và rời phòng

### User rời phòng

```ts
await emitAck(socket, 'room:leave', { roomId }).catch(() => undefined)
livekit.disconnect()
socket.disconnect()
```

### Host đóng phòng

Chọn **một** cách, không gửi đồng thời REST và Socket.

```ts
// Cách REST, dễ dùng cho nút UI.
await axios.patch(
  `${API_BASE_URL}/study-rooms/${roomId}/close`,
  null,
  { headers: { Authorization: `Bearer ${accessToken}` } }
)

// Hoặc cách Socket.
await emitAck(socket, 'room:close', { roomId })
```

Sau khi thành công, tất cả client, kể cả host, nhận `room:closed`. Tại event này: dừng heartbeat, `livekit.disconnect()`, `socket.disconnect()`, rồi điều hướng ra ngoài.

Gọi close lặp lại sau khi hoàn tất trả HTTP/ack thành công với room `status: closed`. Nếu một close khác đang chạy, nhận `409` hoặc code `ROOM_CLOSING`; disable nút và retry một lần sau 1-2 giây.

## 8. Bảng xử lý lỗi

| Nguồn | Code | Hành động FE |
|---|---|---|
| Socket connect | `UNAUTHORIZED` | Refresh login hoặc đưa về trang đăng nhập. |
| `room:join` | `ACTIVE_ROOM_CONFLICT` | User đang ở phòng khác; hiển thị dialog để rời phòng cũ. |
| `room:join` | `SWITCH_REQUIRED` | Không tạo deviceId mới; hướng dẫn user rời phiên trên thiết bị cũ. |
| `room:join` | `ROOM_FULL` | Hiện phòng đã đủ người. |
| Heartbeat | `SESSION_TAKEN_OVER` | Dừng socket/LiveKit, hiện trạng thái phiên đã bị thay thế. |
| REST media | `409` | Không retry REST liên tục; join Socket lại rồi gọi lại token. |
| REST media/close | `503` | Dịch vụ LiveKit chưa sẵn sàng; cho retry thủ công. |
| Close | `403` / `NOT_HOST` | Ẩn hoặc disable nút close với member. |
| Close | `409` / `ROOM_CLOSING` | Disable nút, retry ngắn và đọc lại state. |
| Broadcast | `room:closed` | Dừng toàn bộ kết nối, rời màn hình. |

## 9. Test bằng Postman

REST tab thông thường không tạo Socket.IO lease. Muốn test token trên Postman phải giữ **một Socket.IO request đang connect**.

1. Lấy `accessToken` của host/member, `studyRoomId`, và đặt environment variables:

```text
baseOrigin = http://localhost:3000
baseUrl = http://localhost:3000/api/v1
deviceId = postman-study-room-device-01
```

2. Tạo một **Socket.IO request** trong Postman, không phải HTTP hoặc WebSocket raw. URL:

```text
{{baseOrigin}}/study-rooms
```

3. Trong phần Socket.IO handshake authentication, đặt JSON:

```json
{
  "token": "{{accessToken}}",
  "deviceId": "{{deviceId}}"
}
```

`token` là JWT raw, không thêm `Bearer `. Bấm Connect và giữ request này mở.

4. Gửi Socket event:

```text
Event: room:join
Message:
{ "roomId": "{{studyRoomId}}" }
```

Ack cần là `ok: true`. Nếu không có ack thành công, không test `media-token` tiếp.

5. Trong HTTP request `Create Room Media Token`, gửi:

```http
Authorization: Bearer {{accessToken}}
x-device-id: {{deviceId}}
```

Kết quả mong đợi là `200`, body chứa `data.token`, `data.url`, `data.identity`.

6. Để test lease vẫn sống, trong tab Socket.IO gửi `room:heartbeat` với `{ "roomId": "{{studyRoomId}}" }` trước khi qua 75 giây. Postman không phù hợp để chạy timer 25 giây tự động; test dài hạn nên dùng frontend hoặc script Socket.IO.

7. Test close bằng HTTP `PATCH {{baseUrl}}/study-rooms/{{studyRoomId}}/close` với token của host. Kết quả `200`, socket nhận event `room:closed`. Gửi lại request close: vẫn `200` và room có `status: "closed"`.

Nếu Postman version đang dùng không có Socket.IO request hoặc không cho truyền `auth` handshake JSON, Postman HTTP không thể test thành công media token theo contract hiện tại. Dùng frontend test page hoặc một script `socket.io-client`; không hạ bảo mật backend để phục vụ Postman.

## 10. Checklist nghiệm thu FE

- [ ] Một `deviceId` ổn định được lưu localStorage và dùng ở Socket + REST.
- [ ] Chỉ gọi media token sau ack `room:join` thành công.
- [ ] Heartbeat chạy 25 giây, được dừng khi rời/đóng/kick/takeover.
- [ ] UI dựng từ snapshot `room:join`, không tự đếm Pomodoro.
- [ ] Nhận `room:closed` thì dừng LiveKit, dừng Socket, điều hướng.
- [ ] Member không thấy nút close; host xử lý `ROOM_CLOSING` khi double-click/retry.
- [ ] Xử lý `409` media bằng rejoin, không gọi REST retry liên tục.
- [ ] Socket reconnect luôn `room:join` lại trước mọi thao tác realtime/media.
