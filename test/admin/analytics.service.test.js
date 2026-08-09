import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { buildDateRange, fillDailySeries } from '../../src/services/admin/analytics.service.js'
import { USER_ROLE } from '../../src/constants/index.js'
import { userModel } from '../../src/models/index.js'
import { analyticsValidation } from '../../src/validations/admin/index.js'
import adminMiddleware from '../../src/middlewares/admin.middleware.js'

const originalUserExists = userModel.exists

afterEach(() => {
  userModel.exists = originalUserExists
})

const runAdminMiddleware = (req) =>
  new Promise((resolve) => {
    adminMiddleware(req, {}, resolve)
  })

describe('admin analytics', () => {
  test('user mới mặc định không có quyền admin', () => {
    const user = new userModel({
      email: 'user@example.com',
      passwordHash: 'hash',
      displayName: 'User'
    })

    assert.equal(user.role, USER_ROLE.USER)
  })

  test('tính đúng 7 ngày theo múi giờ Việt Nam', () => {
    const range = buildDateRange(7, new Date('2026-08-09T17:30:00.000Z'))

    assert.equal(range.startKey, '2026-08-04')
    assert.equal(range.dateKeys.at(-1), '2026-08-10')
    assert.equal(range.startAt.toISOString(), '2026-08-03T17:00:00.000Z')
    assert.equal(range.endAt.toISOString(), '2026-08-10T17:00:00.000Z')
  })

  test('điền số 0 cho ngày không có dữ liệu', () => {
    assert.deepEqual(fillDailySeries(['2026-08-08', '2026-08-09'], [{ _id: '2026-08-09', newUsers: 3 }], ['newUsers']), [
      { date: '2026-08-08', newUsers: 0 },
      { date: '2026-08-09', newUsers: 3 }
    ])
  })

  test('chỉ chấp nhận khoảng thống kê 7, 30 hoặc 90 ngày', () => {
    assert.equal(analyticsValidation.overview.query.validate({}).value.days, 30)
    assert.equal(analyticsValidation.overview.query.validate({ days: 7 }).error, undefined)
    assert.ok(analyticsValidation.overview.query.validate({ days: 14 }).error)
  })

  test('từ chối user không có role admin', async () => {
    userModel.exists = async () => null

    const error = await runAdminMiddleware({ user: { _id: 'user-id' } })

    assert.equal(error.statusCode, 403)
  })

  test('cho phép user có role admin', async () => {
    let filter
    userModel.exists = async (value) => {
      filter = value
      return { _id: 'admin-id' }
    }

    const error = await runAdminMiddleware({ user: { _id: 'admin-id' } })

    assert.equal(error, undefined)
    assert.deepEqual(filter, { _id: 'admin-id', role: USER_ROLE.ADMIN })
  })
})
