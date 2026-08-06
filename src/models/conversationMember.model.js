import mongoose, { model } from 'mongoose'

const conversationMemberSchema = new mongoose.Schema(
    {
        conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        unreadCount: { type: Number, default: 0, min: 0 },
        lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'DirectMessage', default: null },
        lastReadAt: { type: Date, default: null }
    },
    { timestamps: true }
)

conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true })
conversationMemberSchema.index({ userId: 1, updatedAt: -1 })

export default model('ConversationMember', conversationMemberSchema)