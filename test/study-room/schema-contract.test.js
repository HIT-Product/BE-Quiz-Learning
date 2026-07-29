import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import * as constantsIndex from '../../src/constants/index.js'
import * as studyRoomConstants from '../../src/constants/studyRoom.constant.js'
import roomParticipantModel from '../../src/models/roomParticipant.model.js'
import studyRoomModel from '../../src/models/studyRoom.model.js'
import studyRoomValidation from '../../src/validations/client/studyRoom.validation.js'

const {
  ROOM_CLOSE_LOCK_SECONDS,
  ROOM_DEVICE_TTL_SECONDS,
  ROOM_LIMITS,
  ROOM_REDIS_KEY,
  ROOM_REDIS_TTL_SECONDS,
  ROOM_ROLE,
  ROOM_SESSION_TTL_SECONDS,
  ROOM_STATUS,
  ROOM_VISIBILITY
} = studyRoomConstants

const validCreatePayload = (visibility) => ({
  title: `Study Room ${visibility}`,
  visibility,
  pomodoroWorkMin: 25,
  pomodoroBreakMin: 5,
  maxParticipants: ROOM_LIMITS.MAX_PARTICIPANTS_HARD,
  settings: {}
})

const validRoomDocument = (visibility) =>
  new studyRoomModel({
    ...validCreatePayload(visibility),
    hostId: new mongoose.Types.ObjectId(),
    roomCode: visibility === ROOM_VISIBILITY.PUBLIC ? 'PUBLIC0001' : 'PRIVATE001'
  })

test('study-room constants remain available through the constants barrel', () => {
  const expectedExports = [
    'ROOM_VISIBILITY',
    'ROOM_STATUS',
    'ROOM_ROLE',
    'POMODORO_PHASE',
    'POMODORO_STATUS',
    'ROOM_LIMITS',
    'ROOM_REDIS_KEY',
    'ROOM_REDIS_TTL_SECONDS',
    'ROOM_DEVICE_TTL_SECONDS',
    'ROOM_CLOSE_LOCK_SECONDS',
    'ROOM_SESSION_TTL_SECONDS'
  ]

  for (const exportName of expectedExports) {
    assert.ok(exportName in constantsIndex, `${exportName} must remain exported from constants/index.js`)
    assert.equal(constantsIndex[exportName], studyRoomConstants[exportName])
  }

  assert.deepEqual(ROOM_VISIBILITY, { PUBLIC: 'public', PRIVATE: 'private' })
  assert.deepEqual(ROOM_STATUS, { OPEN: 'open', CLOSING: 'closing', CLOSED: 'closed' })
  assert.deepEqual(ROOM_ROLE, { HOST: 'host', MEMBER: 'member' })
  assert.equal(ROOM_REDIS_TTL_SECONDS, 24 * 60 * 60)
  assert.equal(ROOM_DEVICE_TTL_SECONDS, 24 * 60 * 60)
  assert.equal(ROOM_CLOSE_LOCK_SECONDS, 60)
})

test('Plan 01 timing contracts have the expected values', () => {
  assert.equal(ROOM_LIMITS.JOIN_RESERVATION_SECONDS, 120)
  assert.equal(ROOM_LIMITS.PRESENCE_STALE_SECONDS, 75)
  assert.equal(ROOM_LIMITS.HEARTBEAT_SECONDS, 25)
  assert.equal(ROOM_LIMITS.SWITCH_REQUEST_SECONDS, 60)
  assert.equal(ROOM_LIMITS.SWITCH_REQUESTS_PER_MINUTE, 5)
  assert.equal(ROOM_LIMITS.EMPTY_CLOSE_MINUTES, 10)
  assert.equal(ROOM_SESSION_TTL_SECONDS, ROOM_LIMITS.PRESENCE_STALE_SECONDS)
})

test('existing and Plan 01 Redis key factories remain available', () => {
  const expectedFactories = [
    'PRESENCE',
    'ACTIVE_DEVICE',
    'DEVICE_GENERATION',
    'CLOSE_LOCK',
    'POMODORO',
    'LEADERBOARD',
    'STUDY_MARK',
    'STUDY_MARK_INDEX',
    'RL_CHAT',
    'RL_SOCKET',
    'RL_SWITCH',
    'SWITCH_REQUEST'
  ]

  for (const factoryName of expectedFactories) {
    assert.equal(typeof ROOM_REDIS_KEY[factoryName], 'function', `${factoryName} must remain a Redis key factory`)
  }
})

test('Joi accepts public and private room creation payloads', async (t) => {
  for (const visibility of Object.values(ROOM_VISIBILITY)) {
    await t.test(visibility, () => {
      const { error, value } = studyRoomValidation.create.body.validate(validCreatePayload(visibility))

      assert.equal(error, undefined)
      assert.equal(value.visibility, visibility)
    })
  }
})

test('Mongoose accepts public and private room documents', async (t) => {
  for (const visibility of Object.values(ROOM_VISIBILITY)) {
    await t.test(visibility, async () => {
      const room = validRoomDocument(visibility)

      await room.validate()
      assert.equal(room.visibility, visibility)
    })
  }
})

test('maxParticipants=16 is rejected by Joi', () => {
  const { error } = studyRoomValidation.create.body.validate({
    ...validCreatePayload(ROOM_VISIBILITY.PRIVATE),
    maxParticipants: 16
  })

  assert.ok(error)
  assert.ok(error.details.some((detail) => detail.path.join('.') === 'maxParticipants'))
})

test('maxParticipants=16 is rejected by Mongoose', async () => {
  const room = validRoomDocument(ROOM_VISIBILITY.PRIVATE)
  room.maxParticipants = 16

  await assert.rejects(room.validate(), (error) => {
    assert.ok(error?.errors.maxParticipants)
    assert.equal(error.errors.maxParticipants.kind, 'max')
    return true
  })
})

test('room and reservation fields required by Plan 01 exist in the schemas', () => {
  assert.equal(studyRoomModel.schema.path('emptySince').instance, 'Date')
  assert.equal(roomParticipantModel.schema.path('joinExpiresAt').instance, 'Date')

  const room = validRoomDocument(ROOM_VISIBILITY.PRIVATE)
  const participant = new roomParticipantModel({
    roomId: room._id,
    userId: new mongoose.Types.ObjectId()
  })

  assert.equal(room.emptySince, null)
  assert.equal(participant.joinExpiresAt, null)
})

test('participant reservation and active-room indexes remain declared', () => {
  const indexes = roomParticipantModel.schema.indexes()
  const activeRoomIndex = indexes.find(([, options]) => options.name === 'one_active_room_per_user')
  const reservationIndex = indexes.find(([fields]) => fields.joinExpiresAt === 1)

  assert.ok(activeRoomIndex)
  assert.deepEqual(activeRoomIndex[0], { userId: 1 })
  assert.equal(activeRoomIndex[1].unique, true)
  assert.deepEqual(activeRoomIndex[1].partialFilterExpression, { leftAt: null })

  assert.ok(reservationIndex)
  assert.deepEqual(reservationIndex[1].partialFilterExpression, {
    joinExpiresAt: { $type: 'date' }
  })
})
