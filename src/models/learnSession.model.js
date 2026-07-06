import mongoose, { model } from 'mongoose'

import {
    QUESTION_TYPE,
    LEARN_SESSION_MODE,
    LEARN_SESSION_STATUS,
    LEARN_ANSWER_SIDE,
    LEARN_SCOPE,
    WRITTEN_GRADE_MODE
} from '../constants/index.js'

const cardStateSchema = new mongoose.Schema(
    {
        flashcardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true },
        stage: { type: Number, default: 0 },
        correctTotal: { type: Number, default: 0 },
        wrongTotal: { type: Number, default: 0 },
        exposed: { type: Boolean, default: false }, // Đã qua bước phơi nhiễm flashcard chưa
        mastered: { type: Boolean, default: false },
        due: { type: Number, default: null } // null = chưa kích hoạt; số = mốc step nên xuất hiện
    },
    { _id: false }
)

const learnSessionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
        mode: {
            type: String,
            enum: Object.values(LEARN_SESSION_MODE),
            default: LEARN_SESSION_MODE.MASTER
        },
        config: {
            types: {
                type: [String],
                enum: Object.values(QUESTION_TYPE),
                default: Object.values(QUESTION_TYPE)
            },
            answerSide: {
                type: String,
                enum: Object.values(LEARN_ANSWER_SIDE),
                default: LEARN_ANSWER_SIDE.FRONT
            },
            blockSize: { type: Number, default: 7 },
            activeSetSize: { type: Number, default: 7 },
            masteryTarget: { type: Number, default: 1 },
            sessionLimit: { type: Number, default: null },
            scope: {
                type: String,
                enum: Object.values(LEARN_SCOPE),
                default: LEARN_SCOPE.ALL
            },
            writtenGradeMode: {
                type: String,
                enum: Object.values(WRITTEN_GRADE_MODE),
                default: WRITTEN_GRADE_MODE.MODERATE
            },
            timeTargetMin: { type: Number, default: null }
        },
        cards: { type: [cardStateSchema], default: [] },
        step: { type: Number, default: 0 }, // Số câu đã trả lời = đồng hồ lịch trình
        current: { type: mongoose.Schema.Types.Mixed, default: null }, // Câu đang chờ trả lời
        lastCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', default: null },
        lastGraded: { type: mongoose.Schema.Types.Mixed, default: null }, // Phục vụ override
        stats: {
            totalCorrect: { type: Number, default: 0 },
            totalWrong: { type: Number, default: 0 }
        },
        status: {
            type: String,
            enum: Object.values(LEARN_SESSION_STATUS),
            default: LEARN_SESSION_STATUS.IN_PROGRESS
        },
        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null }
    },
    { timestamps: true }
)

learnSessionSchema.index({ userId: 1, deckId: 1 })
// Chỉ cho phép 1 session in_progress trên mỗi user+deck
learnSessionSchema.index(
    { userId: 1, deckId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: LEARN_SESSION_STATUS.IN_PROGRESS }
    }
)

export default model('LearnSession', learnSessionSchema)