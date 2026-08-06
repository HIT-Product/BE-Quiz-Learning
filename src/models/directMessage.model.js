import mongoose, { model } from 'mongoose'

import { SOCIAL_LIMITS } from '../constants/index.js'

const directMessageSchema = new mongoose.Schema(
    {
        conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        clientMessageId: {
            type: String,
            required: true,
            trim: true,
            maxlength: SOCIAL_LIMITS.CLIENT_MESSAGE_ID_MAX
        },
        body: { type: String, required: true, trim: true, maxlength: SOCIAL_LIMITS.DM_BODY_MAX }
    },
    { timestamps: true }
)

directMessageSchema.index(
    { conversationId: 1, senderId: 1, clientMessageId: 1 },
    { unique: true }
)
directMessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 })

export default model('DirectMessage', directMessageSchema)