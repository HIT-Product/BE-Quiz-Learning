import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'

import { redisClient } from '../../src/configs/index.js'
import { ROOM_ROLE, ROOM_VISIBILITY } from '../../src/constants/index.js'
import { roomParticipantModel, studyRoomModel } from '../../src/models/index.js'
import studyRoomService from '../../src/services/client/studyRoom.service.js'

after(() => {
  redisClient.disconnect()
})

const openRoom = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  roomCode: 'ROOMCODE01',
  ...overrides
})

const stubReservationQueries = (t, existing = null) => {
  t.mock.method(roomParticipantModel, 'updateMany', async () => ({ modifiedCount: 0 }))
  t.mock.method(roomParticipantModel, 'findOne', async () => existing)
}

test('create accepts public/private rooms, reserves the host, and initializes emptySince', async (t) => {
  for (const visibility of Object.values(ROOM_VISIBILITY)) {
    await t.test(visibility, async (t) => {
      let createdRoom
      let createdParticipant

      t.mock.method(studyRoomModel, 'create', async (data) => {
        createdRoom = { ...data, _id: new mongoose.Types.ObjectId() }
        return createdRoom
      })
      stubReservationQueries(t)
      t.mock.method(roomParticipantModel, 'create', async (data) => {
        createdParticipant = data
        return data
      })

      const hostId = new mongoose.Types.ObjectId()
      const result = await studyRoomService.create(hostId, {
        title: `${visibility} room`,
        visibility,
        maxParticipants: 15
      })

      assert.equal(result, createdRoom)
      assert.equal(createdRoom.visibility, visibility)
      assert.ok(createdRoom.emptySince instanceof Date)
      assert.equal(String(createdParticipant.roomId), String(createdRoom._id))
      assert.equal(String(createdParticipant.userId), String(hostId))
      assert.equal(createdParticipant.role, ROOM_ROLE.HOST)
      assert.ok(createdParticipant.joinExpiresAt instanceof Date)
    })
  }
})

test('join reservation expires approximately 120 seconds after creation', async (t) => {
  const room = openRoom()
  let reservation

  t.mock.method(studyRoomModel, 'findOne', async () => room)
  stubReservationQueries(t)
  t.mock.method(roomParticipantModel, 'create', async (data) => {
    reservation = data
    return data
  })

  const startedAt = Date.now()
  const result = await studyRoomService.joinByCode(new mongoose.Types.ObjectId(), room.roomCode)
  const finishedAt = Date.now()

  assert.equal(result, room)
  assert.ok(reservation.joinExpiresAt instanceof Date)
  assert.ok(reservation.joinExpiresAt.getTime() >= startedAt + 120_000)
  assert.ok(reservation.joinExpiresAt.getTime() <= finishedAt + 120_100)
})

test('banned user cannot reserve the same room', async (t) => {
  const room = openRoom()
  const bannedParticipant = {
    _id: new mongoose.Types.ObjectId(),
    bannedAt: new Date(),
    leftAt: new Date()
  }

  t.mock.method(studyRoomModel, 'findOne', async () => room)
  stubReservationQueries(t, bannedParticipant)

  await assert.rejects(
    studyRoomService.joinByCode(new mongoose.Types.ObjectId(), room.roomCode),
    (error) => {
      assert.equal(error.statusCode, StatusCodes.FORBIDDEN)
      return true
    }
  )
})

test('active room uniqueness conflict is returned as HTTP 409', async (t) => {
  const room = openRoom()
  const duplicateError = Object.assign(
    new Error('E11000 duplicate key one_active_room_per_user'),
    { code: 11000 }
  )

  t.mock.method(studyRoomModel, 'findOne', async () => room)
  stubReservationQueries(t)
  t.mock.method(roomParticipantModel, 'create', async () => {
    throw duplicateError
  })

  await assert.rejects(
    studyRoomService.joinByCode(new mongoose.Types.ObjectId(), room.roomCode),
    (error) => {
      assert.equal(error.statusCode, StatusCodes.CONFLICT)
      return true
    }
  )
})

test('media token stays separate from the realtime room close lifecycle', () => {
  assert.equal(typeof studyRoomService.close, 'undefined')
  assert.equal(typeof studyRoomService.mediaToken, 'function')
})
