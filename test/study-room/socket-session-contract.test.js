import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const handlerPath = new URL('../../src/sockets/handlers/room.handler.js', import.meta.url)

test('room join uses the atomic session service contract', async () => {
  const source = await readFile(handlerPath, 'utf8')

  assert.match(source, /roomSessionService\.claimJoin\(/)
  assert.match(source, /roomSessionService\.rollbackClaim\(/)
  assert.doesNotMatch(source, /roomSessionService\.claimDevice\(/)
  assert.doesNotMatch(source, /roomSessionService\.joinPresence\(/)
})

test('room join maps expected lease conflicts to client-safe socket errors', async () => {
  const source = await readFile(handlerPath, 'utf8')

  for (const status of ['ACTIVE_OTHER_ROOM', 'SWITCH_REQUIRED', 'STALE_SWITCH', 'ROOM_FULL']) {
    assert.match(source, new RegExp(`${status}:`))
  }
})

test('room leave is idempotent and stale sockets cannot clear a newer device session', async () => {
  const source = await readFile(handlerPath, 'utf8')
  const finishLeave = source.match(/const finishLeave =[\s\S]*?(?=const assertClaimAccepted)/)
  const leaveHandler = source.match(
    /socket\.on\(\s*'room:leave',[\s\S]*?\n\s*\)\s*\n\s*\n\s*socket\.on\(\s*'leaderboard:get'/
  )

  assert.ok(finishLeave)
  assert.ok(leaveHandler)
  assert.match(finishLeave[0], /roomSessionService\.releaseDevice/)
  assert.match(finishLeave[0], /roomSessionService\.getActiveDevice/)
  assert.match(finishLeave[0], /stale: true/)
  assert.match(finishLeave[0], /markParticipantLeft/)
  assert.match(finishLeave[0], /socket\.data\.roomId = null/)
  assert.doesNotMatch(leaveHandler[0], /assertDeviceOwner/)
})
