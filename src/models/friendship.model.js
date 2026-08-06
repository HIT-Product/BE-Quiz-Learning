import mongoose, { model } from 'mongoose'

import { FRIENDSHIP_STATUS } from '../constants/index.js'

const friendshipSchema = new mongoose.Schema(
    {
        userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        addresseeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
            type: String,
            enum: Object.values(FRIENDSHIP_STATUS),
            required: true
        },
        requestedAt: { type: Date, required: true },
        respondedAt: { type: Date, default: null }
    },
    { timestamps: true }
)

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true })
friendshipSchema.index({ userA: 1, status: 1, respondedAt: -1 })
friendshipSchema.index({ userB: 1, status: 1, respondedAt: -1 })
friendshipSchema.index({ addresseeId: 1, status: 1, requestedAt: -1 })
friendshipSchema.index({ requesterId: 1, status: 1, requestedAt: -1 })

export default model('Friendship', friendshipSchema)