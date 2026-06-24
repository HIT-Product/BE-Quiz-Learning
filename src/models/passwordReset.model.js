import mongoose, { model } from "mongoose";

const passwordResetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        otpHash: {
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

// TTL index: Mongo tu xoa ban ghi khi qua expiresAt
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default model('PasswordReset', passwordResetSchema)