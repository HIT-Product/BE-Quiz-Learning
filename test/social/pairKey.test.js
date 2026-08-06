import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { toPairKey } from '../../src/utils/pairKey.js'

describe('toPairKey', () => {
    const first = '64b000000000000000000001'
    const second = '64b000000000000000000002'

    test('trả cùng pair dù đảo thứ tự input', () => {
        assert.deepEqual(toPairKey(first, second), toPairKey(second, first))
        assert.deepEqual(toPairKey(second, first), { userA: first, userB: second })
    })

    test('từ chối cặp gồm cùng một user', () => {
        assert.throws(() => toPairKey(first, first), /phải khác nhau/)
    })

    test('từ chối ObjectId không hợp lệ', () => {
        assert.throws(() => toPairKey('invalid', second), /không hợp lệ/)
    })
})