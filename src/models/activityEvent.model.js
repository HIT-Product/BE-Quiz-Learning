import mongoose, { model } from 'mongoose'

import { ACTIVITY_EVENT_TYPE, ACTIVITY_VISIBILITY } from '../constants/index.js'

const activityEventSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: Object.values(ACTIVITY_EVENT_TYPE), required: true },
        visibility: {
            type: String,
            enum: Object.values(ACTIVITY_VISIBILITY),
            default: ACTIVITY_VISIBILITY.FRIENDS
        },
        deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', default: null },
        deckTitle: { type: String, default: null },
        score: { type: Number, default: null },
        streakDays: { type: Number, default: null },
        dedupKey: { type: String, required: true },
        occurredAt: { type: Date, required: true }
    },
    { timestamps: true }
)

activityEventSchema.index({ userId: 1, occurredAt: -1 })
activityEventSchema.index({ userId: 1, dedupKey: 1 }, { unique: true })

export default model('ActivityEvent', activityEventSchema)