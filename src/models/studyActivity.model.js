import mongoose, { model } from 'mongoose'

const studyActivitySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        dateKey: {
      type: String, // Định dạng YYYY-MM-DD theo timezone đã chốt.
            required: true
        },
        timezone: {
            type: String,
            default: 'Asia/Ho_Chi_Minh'
        },
        firstActivityAt: {
            type: Date,
            required: true
        },
        lastActivityAt: {
            type: Date,
            required: true
        },
        sources: {
            type: [String],
            default: []
        }
    },
    { timestamps: true }
)

studyActivitySchema.index({ userId: 1, dateKey: 1 }, { unique: true })

export default model('StudyActivity', studyActivitySchema)
