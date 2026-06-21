import mongoose, { model } from 'mongoose'

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        tokenHash: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        }

    },
    {
        timestamps: true
    }
)

sessionSchema.index({ tokenHash: 1 }) // query nhanh khi refresh/logout
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL: Mongo tự xóa khi expiresAt đã qua

export default model('Session', sessionSchema)


