import mongoose from 'mongoose'

const toPairKey = (idA, idB) => {
    const left = String(idA)
    const right = String(idB)

    if (!mongoose.isValidObjectId(left) || !mongoose.isValidObjectId(right)) {
        throw new TypeError('User id không hợp lệ.')
    }
    if (left === right) {
        throw new TypeError('Hai user trong một cặp phải khác nhau.')
    }

    const [userA, userB] = [left, right].sort()
    return { userA, userB }
}

export { toPairKey }
export default toPairKey