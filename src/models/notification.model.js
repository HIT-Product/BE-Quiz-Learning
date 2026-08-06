import mongoose, { model } from 'mongoose'

import { NOTIFICATION_TYPE } from '../constants/index.js'

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
        entityType: { type: String, default: null },
        entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
        dedupKey: { type: String, default: null },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
        readAt: { type: Date, default: null }
    },
    { timestamps: true }
)

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })
notificationSchema.index(
    { userId: 1, dedupKey: 1 },
    { unique: true, partialFilterExpression: { dedupKey: { $type: 'string' } } }
)

export default model('Notification', notificationSchema)
