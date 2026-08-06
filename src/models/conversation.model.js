import mongoose, { model } from 'mongoose'

import { SOCIAL_LIMITS } from '../constants/index.js'

const conversationSchema = new mongoose.Schema(
    {
        userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        lastMessageAt: { type: Date, default: null },
        lastMessagePreview: { type: String, default: null, maxlength: SOCIAL_LIMITS.DM_PREVIEW_MAX }
    },
    { timestamps: true }
)

conversationSchema.index({ userA: 1, userB: 1 }, { unique: true })
conversationSchema.index({ userA: 1, lastMessageAt: -1 })
conversationSchema.index({ userB: 1, lastMessageAt: -1 })

export default model('Conversation', conversationSchema)