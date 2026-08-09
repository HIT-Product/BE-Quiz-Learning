import {
  deckModel,
  flashcardModel,
  quizAttemptModel,
  studyActivityModel,
  studyRoomModel,
  userModel
} from '../../models/index.js'
import { DECK_VISIBILITY } from '../../constants/index.js'

const ANALYTICS_TIMEZONE = 'Asia/Ho_Chi_Minh'

const toDateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

const buildDateRange = (days, now = new Date()) => {
  const todayKey = toDateKey(now)
  const startKey = shiftDateKey(todayKey, -(days - 1))
  const endKey = shiftDateKey(todayKey, 1)
  const dateKeys = Array.from({ length: days }, (_, index) => shiftDateKey(startKey, index))

  return {
    days,
    startKey,
    endKey,
    startAt: new Date(`${startKey}T00:00:00+07:00`),
    endAt: new Date(`${endKey}T00:00:00+07:00`),
    dateKeys
  }
}

const fillDailySeries = (dateKeys, rows, fields) => {
  const byDate = new Map(rows.map((row) => [row._id, row]))

  return dateKeys.map((date) => {
    const source = byDate.get(date) || {}
    return {
      date,
      ...Object.fromEntries(fields.map((field) => [field, source[field] || 0]))
    }
  })
}

const aggregateByDate = (model, dateField, range, valueField) =>
  model.aggregate([
    {
      $match: {
        [dateField]: { $gte: range.startAt, $lt: range.endAt }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: `$${dateField}`,
            timezone: ANALYTICS_TIMEZONE
          }
        },
        [valueField]: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ])

const getOverview = async ({ days = 30 } = {}, now = new Date()) => {
  const range = buildDateRange(days, now)
  const submittedQuizFilter = { submittedAt: { $ne: null } }

  const [
    totalUsers,
    newUsers,
    activeUserIds,
    totalDecks,
    newDecks,
    totalFlashcards,
    totalQuizAttempts,
    quizSummary,
    totalStudyRooms,
    newStudyRooms,
    userTrend,
    deckTrend,
    quizTrend,
    activityTrend,
    topDecks
  ] = await Promise.all([
    userModel.countDocuments(),
    userModel.countDocuments({ createdAt: { $gte: range.startAt, $lt: range.endAt } }),
    studyActivityModel.distinct('userId', { dateKey: { $gte: range.startKey, $lt: range.endKey } }),
    deckModel.countDocuments(),
    deckModel.countDocuments({ createdAt: { $gte: range.startAt, $lt: range.endAt } }),
    flashcardModel.countDocuments(),
    quizAttemptModel.countDocuments(submittedQuizFilter),
    quizAttemptModel.aggregate([
      {
        $match: {
          submittedAt: { $gte: range.startAt, $lt: range.endAt }
        }
      },
      {
        $group: {
          _id: null,
          attempts: { $sum: 1 },
          averageScore: { $avg: '$score' }
        }
      }
    ]),
    studyRoomModel.countDocuments(),
    studyRoomModel.countDocuments({ createdAt: { $gte: range.startAt, $lt: range.endAt } }),
    aggregateByDate(userModel, 'createdAt', range, 'newUsers'),
    aggregateByDate(deckModel, 'createdAt', range, 'newDecks'),
    aggregateByDate(quizAttemptModel, 'submittedAt', range, 'quizAttempts'),
    studyActivityModel.aggregate([
      { $match: { dateKey: { $gte: range.startKey, $lt: range.endKey } } },
      { $group: { _id: '$dateKey', users: { $addToSet: '$userId' } } },
      { $project: { activeUsers: { $size: '$users' } } },
      { $sort: { _id: 1 } }
    ]),
    deckModel
      .find({ visibility: DECK_VISIBILITY.PUBLIC })
      .sort({ copyCount: -1, cardCount: -1, updatedAt: -1 })
      .limit(5)
      .select('title cardCount copyCount ownerId')
      .populate('ownerId', 'displayName email')
      .lean()
  ])

  const dailyUsers = fillDailySeries(range.dateKeys, userTrend, ['newUsers'])
  const dailyActivity = fillDailySeries(range.dateKeys, activityTrend, ['activeUsers'])
  const dailyDecks = fillDailySeries(range.dateKeys, deckTrend, ['newDecks'])
  const dailyQuizzes = fillDailySeries(range.dateKeys, quizTrend, ['quizAttempts'])
  const daily = range.dateKeys.map((date, index) => ({
    date,
    newUsers: dailyUsers[index].newUsers,
    activeUsers: dailyActivity[index].activeUsers,
    newDecks: dailyDecks[index].newDecks,
    quizAttempts: dailyQuizzes[index].quizAttempts
  }))
  const periodQuiz = quizSummary[0] || {}

  return {
    period: {
      days,
      from: range.startKey,
      to: range.dateKeys.at(-1),
      timezone: ANALYTICS_TIMEZONE
    },
    kpis: {
      users: { total: totalUsers, new: newUsers, active: activeUserIds.length },
      content: { totalDecks, newDecks, totalFlashcards },
      learning: {
        totalQuizAttempts,
        periodQuizAttempts: periodQuiz.attempts || 0,
        averageQuizScore: periodQuiz.averageScore ? Math.round(periodQuiz.averageScore * 100) / 100 : 0
      },
      studyRooms: { total: totalStudyRooms, new: newStudyRooms }
    },
    daily,
    topDecks
  }
}

export { ANALYTICS_TIMEZONE, buildDateRange, fillDailySeries }
export default { getOverview }
