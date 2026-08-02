import mongoose from 'mongoose'

import {
  deckModel,
  folderModel,
  cardProgressModel,
  quizAttemptModel,
  studyActivityModel
} from '../../models/index.js'
import { calculateStudyStreak, toDateKey } from './studyActivity.service.js'

// Tổng hợp dữ liệu Dashboard của một người dùng.
const getOverview = async (userId) => {
  // Mongoose không tự ép kiểu ObjectId bên trong aggregation pipeline.
  const ownerId = new mongoose.Types.ObjectId(userId)

  // Các truy vấn không phụ thuộc nhau nên được chạy song song.
  const [
    totalDecks,
    totalFolders,
    cardAgg,
    progressAgg,
    quizAgg,
    activityDays,
    recentDecks,
    recentAttempts
  ] = await Promise.all([
    deckModel.countDocuments({ ownerId }),
    folderModel.countDocuments({ ownerId }),

    // Tổng số thẻ trong các deck do người dùng sở hữu.
    deckModel.aggregate([{ $match: { ownerId } }, { $group: { _id: null, totalCards: { $sum: '$cardCount' } } }]),

    // Số thẻ theo trạng thái học.
    cardProgressModel.aggregate([
      { $match: { userId: ownerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),

    // Điểm trung bình và số lượt quiz đã nộp.
    quizAttemptModel.aggregate([
      { $match: { userId: ownerId, submittedAt: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$score' }, attempts: { $sum: 1 } } }
    ]),

    // Mỗi document đại diện cho một ngày học trong timezone đã chốt.
    studyActivityModel.find({ userId: ownerId }).sort({ dateKey: 1 }).select('dateKey -_id').lean(),

    // Năm deck được cập nhật gần nhất.
    deckModel.find({ ownerId }).sort({ updatedAt: -1 }).limit(5),

    // Năm lượt quiz gần nhất, kèm tên deck.
    quizAttemptModel
      .find({ userId: ownerId, submittedAt: { $ne: null } })
      .sort({ submittedAt: -1 })
      .limit(5)
      .populate('deckId', 'title')
  ])

  // Aggregation trả mảng rỗng khi chưa có dữ liệu.
  const totalCards = cardAgg[0]?.totalCards || 0

  const progressByStatus = { new: 0, learning: 0, remembered: 0 }
  for (const row of progressAgg) {
    progressByStatus[row._id] = row.count
  }
  const studiedCards = progressByStatus.learning + progressByStatus.remembered

  const avgQuizScore = quizAgg[0] ? Math.round(quizAgg[0].avgScore) : 0
  const totalQuizAttempts = quizAgg[0]?.attempts || 0

  // Tiến độ tổng thể là tỷ lệ thẻ đã nhớ trên tổng số thẻ.
  const overallProgress = totalCards > 0 ? Math.round((progressByStatus.remembered / totalCards) * 100) : 0
  const studyStreak = calculateStudyStreak(
    activityDays.map((activity) => activity.dateKey),
    toDateKey()
  )

  return {
    stats: {
      totalDecks,
      totalFolders,
      totalCards,
      studiedCards,
      avgQuizScore,
      totalQuizAttempts,
      overallProgress
    },
    studyStreak,
    progressByStatus,
    recentDecks,
    recentAttempts
  }
}

export default { getOverview }
