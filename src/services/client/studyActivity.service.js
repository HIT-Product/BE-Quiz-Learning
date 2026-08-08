import { studyActivityModel } from '../../models/index.js'

const STUDY_TIMEZONE = 'Asia/Ho_Chi_Minh'

const STUDY_ACTIVITY_SOURCE = Object.freeze({
  CARD_REVIEW: 'card_review',
  LEARN_SESSION: 'learn_session',
  QUIZ: 'quiz',
  STUDY_ROOM: 'study_room'
})

const toDateKey = (date = new Date()) => {
  const activityAt = new Date(date)
  if (Number.isNaN(activityAt.getTime())) {
    throw new TypeError('Thời điểm học không hợp lệ.')
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(activityAt)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

const calculateStudyStreak = (dateKeys, todayKey = toDateKey()) => {
  const days = [...new Set(dateKeys)].sort()

  if (days.length === 0) {
    return {
      currentDays: 0,
      longestDays: 0,
      lastStudyDate: null,
      timezone: STUDY_TIMEZONE
    }
  }

  let runningDays = 1
  let longestDays = 1

  for (let index = 1; index < days.length; index += 1) {
    runningDays = days[index] === shiftDateKey(days[index - 1], 1) ? runningDays + 1 : 1
    longestDays = Math.max(longestDays, runningDays)
  }

  const lastStudyDate = days.at(-1)
  const isCurrent = lastStudyDate === todayKey || lastStudyDate === shiftDateKey(todayKey, -1)
  let currentDays = isCurrent ? 1 : 0

  if (isCurrent) {
    for (let index = days.length - 1; index > 0; index -= 1) {
      if (days[index - 1] !== shiftDateKey(days[index], -1)) break
      currentDays += 1
    }
  }

  return {
    currentDays,
    longestDays,
    lastStudyDate,
    timezone: STUDY_TIMEZONE
  }
}

const recordStudyActivity = async (userId, source, occurredAt = new Date()) => {
  const activityAt = new Date(occurredAt)
  const dateKey = toDateKey(activityAt)
  const filter = { userId, dateKey }
  const update = {
    $setOnInsert: { timezone: STUDY_TIMEZONE },
    $min: { firstActivityAt: activityAt },
    $max: { lastActivityAt: activityAt },
    $addToSet: { sources: source }
  }

  try {
    await studyActivityModel.updateOne(filter, update, { upsert: true })
  } catch (error) {
    if (error?.code !== 11000) throw error

    // Upsert đồng thời có thể đụng unique index; cập nhật lại document vừa được request khác tạo.
    await studyActivityModel.updateOne(filter, update)
  }
}

export { STUDY_TIMEZONE, STUDY_ACTIVITY_SOURCE, toDateKey, shiftDateKey, calculateStudyStreak, recordStudyActivity }

export default {
  toDateKey,
  calculateStudyStreak,
  recordStudyActivity
}
