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

test('socket join marks the room occupied and socket close returns FEATURE_NOT_READY', async () => {
  const source = await readSource('src/sockets/handlers/room.handler.js')
  const closeHandler = source.match(/socket\.on\(\s*'room:close',[\s\S]*?\n\s*\)\s*\n\s*\n\s*socket\.on\('disconnect'/)

  assert.match(source, /markRoomOccupied\(roomId\)/)
  assert.ok(closeHandler)
  assert.match(closeHandler[0], /FEATURE_NOT_READY/)
  assert.doesNotMatch(closeHandler[0], /closeRoom/)
})

test('REST study-room service delegates media tokens and keeps room close gated', async () => {
  const source = await readSource('src/services/client/studyRoom.service.js')

  assert.doesNotMatch(source, /redisClient|ROOM_REDIS_KEY/)
  assert.doesNotMatch(source, /AccessToken|TrackSource|livekit-server-sdk/)
  assert.match(source, /roomMediaService\.issueParticipantToken/)
  assert.match(source, /const close = featureNotReady/)
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
