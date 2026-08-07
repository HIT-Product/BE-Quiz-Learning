import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

test('server disables and drains the legacy close scheduler before listening', async () => {
  const source = await readSource('src/server.js')
  const removePosition = source.indexOf('removeJobScheduler')
  const drainPosition = source.indexOf('drain(true)')
  const listenPosition = source.indexOf('httpServer.listen')

  assert.ok(removePosition >= 0)
  assert.ok(drainPosition > removePosition)
  assert.ok(listenPosition > drainPosition)
  assert.doesNotMatch(source, /upsertJobScheduler/)
  assert.doesNotMatch(source, /createRoomMaintenanceWorker/)
})

test('empty-room lifecycle updates emptySince without invoking legacy close', async () => {
  const source = await readSource('src/sockets/services/roomRealtime.service.js')
  const match = source.match(/const markRoomBecameEmpty =([\s\S]*?)const markRoomOccupied =/)

  assert.ok(match)
  assert.match(match[1], /emptySince: new Date\(\)/)
  assert.doesNotMatch(match[1], /closeRoom|deleteRoomArtifacts/)
})

test('socket join marks the room occupied while heartbeat and close use the realtime lifecycle', async () => {
  const source = await readSource('src/sockets/handlers/room.handler.js')
  const closeHandler = source.match(/socket\.on\(\s*'room:close',[\s\S]*?\n\s*\)\s*\n\s*\n\s*socket\.on\('disconnect'/)

  assert.match(source, /markRoomOccupied\(roomId\)/)
  assert.match(source, /'room:heartbeat'/)
  assert.match(source, /roomSessionService\.heartbeat/)
  assert.ok(closeHandler)
  assert.match(closeHandler[0], /roomRealtimeService\.closeRoom/)
  assert.doesNotMatch(closeHandler[0], /FEATURE_NOT_READY/)
})

test('REST close delegates to realtime lifecycle while media remains a separate service', async () => {
  const [service, controller] = await Promise.all([
    readSource('src/services/client/studyRoom.service.js'),
    readSource('src/controllers/client/studyRoom.controller.js')
  ])

  assert.doesNotMatch(service, /redisClient|ROOM_REDIS_KEY/)
  assert.doesNotMatch(service, /AccessToken|TrackSource|livekit-server-sdk/)
  assert.match(service, /roomMediaService\.issueParticipantToken/)
  assert.match(controller, /getIO\(\)\.of\('\/study-rooms'\)/)
  assert.match(controller, /roomRealtimeService\.closeRoom/)
})

test('close archives persisted records and releases only ephemeral room resources', async () => {
  const source = await readSource('src/sockets/services/roomRealtime.service.js')
  const closeSection = source.match(/const closeRoom =[\s\S]*?(?=const closeIdleRooms)/)

  assert.ok(closeSection)
  assert.match(source, /const clearRealtimeRoomArtifacts/)
  assert.match(closeSection[0], /status: ROOM_STATUS\.CLOSED/)
  assert.match(closeSection[0], /closedAt/)
  assert.match(closeSection[0], /roomSessionService\.listPresenceEntries/)
  assert.match(closeSection[0], /roomMediaService\.deleteRoom/)
  assert.match(closeSection[0], /return existingRoom/)
  assert.doesNotMatch(source, /roomMessageModel\.deleteMany\(\{ roomId \}\)/)
  assert.doesNotMatch(source, /roomParticipantModel\.deleteMany\(\{ roomId \}\)/)
  assert.doesNotMatch(source, /studyRoomModel\.deleteOne\(\{ _id: roomId \}\)/)
})

test('media grants are derived from room policy and bound to the active device lease', async () => {
  const source = await readSource('src/services/client/roomMedia.service.js')

  assert.match(source, /roomSessionService\.getActiveDevice/)
  assert.match(source, /TrackSource\.CAMERA/)
  assert.match(source, /TrackSource\.MICROPHONE/)
  assert.match(source, /TrackSource\.SCREEN_SHARE/)
  assert.match(source, /TrackSource\.SCREEN_SHARE_AUDIO/)
  assert.match(source, /canSubscribe: true/)
  assert.match(source, /canPublishSources: sources/)
  assert.match(source, /room: String\(room\._id\)/)
  assert.match(source, /if \(allowMicrophone\) sources\.push\(TrackSource\.MICROPHONE\)/)
  assert.match(source, /if \(allowCamera\) sources\.push\(TrackSource\.CAMERA\)/)
  assert.match(source, /if \(allowScreenShare\) sources\.push\(TrackSource\.SCREEN_SHARE, TrackSource\.SCREEN_SHARE_AUDIO\)/)
  assert.doesNotMatch(source, /identity\s*=\s*`[^`]*:/)
})

test('Pomodoro custom job ids avoid BullMQ reserved colons', async () => {
  const [handler, worker] = await Promise.all([
    readSource('src/sockets/handlers/pomodoro.handler.js'),
    readSource('src/workers/pomodoro.worker.js')
  ])

  assert.doesNotMatch(handler, /jobId[^\n]*pomo:/)
  assert.doesNotMatch(worker, /jobId[^\n]*pomo:/)
})

test('leaderboard includes active study marks and exposes an authenticated refresh event', async () => {
  const [service, handler] = await Promise.all([
    readSource('src/sockets/services/roomRealtime.service.js'),
    readSource('src/sockets/handlers/room.handler.js')
  ])

  assert.match(service, /activeStartedAt/)
  assert.match(service, /STUDY_MARK\(roomId, userId\)/)
  assert.match(handler, /'leaderboard:get'/)
  assert.match(handler, /assertDeviceOwner/)
  assert.match(handler, /buildLeaderboard\(roomId\)/)
})
