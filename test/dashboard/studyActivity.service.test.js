import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { studyActivityModel } from '../../src/models/index.js'
import {
  STUDY_ACTIVITY_SOURCE,
  calculateStudyStreak,
  recordStudyActivity,
  toDateKey
} from '../../src/services/client/studyActivity.service.js'

const originalUpdateOne = studyActivityModel.updateOne

afterEach(() => {
  studyActivityModel.updateOne = originalUpdateOne
})

describe('studyActivity.service', () => {
  test('cắt ngày theo timezone Asia/Ho_Chi_Minh', () => {
    assert.equal(toDateKey(new Date('2026-07-29T17:30:00.000Z')), '2026-07-30')
    assert.equal(toDateKey(new Date('2026-07-29T16:59:59.999Z')), '2026-07-29')
  })

  test('trả empty state khi người dùng chưa học', () => {
    assert.deepEqual(calculateStudyStreak([], '2026-07-30'), {
      currentDays: 0,
      longestDays: 0,
      lastStudyDate: null,
      timezone: 'Asia/Ho_Chi_Minh'
    })
  })

  test('giữ current streak nếu ngày học gần nhất là hôm qua', () => {
    const result = calculateStudyStreak(['2026-07-27', '2026-07-28', '2026-07-29'], '2026-07-30')

    assert.equal(result.currentDays, 3)
    assert.equal(result.longestDays, 3)
    assert.equal(result.lastStudyDate, '2026-07-29')
  })

  test('đặt currentDays bằng 0 nếu ngày gần nhất cũ hơn hôm qua', () => {
    const result = calculateStudyStreak(['2026-07-20', '2026-07-21', '2026-07-25'], '2026-07-30')

    assert.equal(result.currentDays, 0)
    assert.equal(result.longestDays, 2)
    assert.equal(result.lastStudyDate, '2026-07-25')
  })

  test('loại ngày trùng khi tính chuỗi', () => {
    const result = calculateStudyStreak(
      ['2026-07-28', '2026-07-29', '2026-07-29', '2026-07-30'],
      '2026-07-30'
    )

    assert.equal(result.currentDays, 3)
    assert.equal(result.longestDays, 3)
  })

  test('retry bằng update thường khi hai upsert đụng unique index', async () => {
    const calls = []
    studyActivityModel.updateOne = async (...args) => {
      calls.push(args)
      if (calls.length === 1) {
        const error = new Error('duplicate key')
        error.code = 11000
        throw error
      }
    }

    await recordStudyActivity('user-1', STUDY_ACTIVITY_SOURCE.QUIZ, new Date('2026-07-30T00:00:00.000Z'))

    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0][2], { upsert: true })
    assert.equal(calls[1][2], undefined)
    assert.equal(calls[0][0].dateKey, '2026-07-30')
    assert.deepEqual(calls[0][1].$addToSet, { sources: 'quiz' })
  })
})
