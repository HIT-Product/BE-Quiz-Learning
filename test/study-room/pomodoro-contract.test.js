import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { serializePomodoroState } from '../../src/sockets/contracts/pomodoro.contract.js'

test('serializes a running Pomodoro with numeric fields and server time', () => {
  assert.deepEqual(
    serializePomodoroState({
      status: 'running',
      phase: 'work',
      startedAt: '1000',
      durationSec: '60',
      cycle: '2'
    }, 11_000),
    {
      status: 'running',
      phase: 'work',
      startedAt: 1000,
      durationSec: 60,
      remainingSec: 50,
      cycle: 2,
      serverNow: 11_000
    }
  )
})

test('serializes paused and idle states as complete payloads', () => {
  assert.deepEqual(
    serializePomodoroState({
      status: 'paused',
      phase: 'break',
      durationSec: '300',
      remainingSec: '125',
      cycle: '4'
    }, 20_000),
    {
      status: 'paused',
      phase: 'break',
      startedAt: null,
      durationSec: 300,
      remainingSec: 125,
      cycle: 4,
      serverNow: 20_000
    }
  )

  assert.deepEqual(serializePomodoroState({}, 30_000), {
    status: 'idle',
    phase: null,
    startedAt: null,
    durationSec: null,
    remainingSec: null,
    cycle: 0,
    serverNow: 30_000
  })
})

test('handler, worker, and room snapshots all use the shared serializer', async () => {
  const [handler, worker, roomRealtime] = await Promise.all([
    readFile(new URL('../../src/sockets/handlers/pomodoro.handler.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/workers/pomodoro.worker.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/sockets/services/roomRealtime.service.js', import.meta.url), 'utf8')
  ])

  assert.match(handler, /serializePomodoroState/)
  assert.match(worker, /serializePomodoroState/)
  assert.match(roomRealtime, /serializePomodoroState/)
  assert.match(handler, /pomodoro:started/)
  assert.match(handler, /pomodoro:paused/)
  assert.match(handler, /pomodoro:resumed/)
  assert.match(handler, /pomodoro:reset/)
  assert.match(worker, /pomodoro:phase-changed/)
})

test('pause, resume, and work-to-break transitions preserve the cycle', () => {
  const cycle = 7
  const paused = serializePomodoroState({ status: 'paused', phase: 'work', durationSec: 60, remainingSec: 30, cycle }, 10_000)
  const resumed = serializePomodoroState({ status: 'running', phase: 'work', startedAt: 10_000, durationSec: 30, cycle }, 10_000)
  const breakPhase = serializePomodoroState({ status: 'running', phase: 'break', startedAt: 40_000, durationSec: 300, cycle }, 40_000)

  assert.equal(paused.cycle, cycle)
  assert.equal(resumed.cycle, cycle)
  assert.equal(breakPhase.cycle, cycle)
})
