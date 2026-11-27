import { StatusCodes } from 'http-status-codes'

import { DECK_VISIBILITY, LEARNING_STATUS, QUESTION_LIMITS, QUESTION_TYPE } from '../../constants/index.js'
import { deckModel, flashcardModel, quizAttemptModel, cardProgressModel, userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { shuffle, matchAnswer } from '../../utils/quiz.js'
import { buildMultipleChoice, buildTrueFalse, buildWritten } from './question.service.js'
import { STUDY_ACTIVITY_SOURCE, recordStudyActivity } from './studyActivity.service.js'

// Kiểm tra quyền truy cập deck.
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== DECK_VISIBILITY.PUBLIC) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

const builders = {
  [QUESTION_TYPE.MULTIPLE_CHOICE]: buildMultipleChoice,
  [QUESTION_TYPE.TRUE_FALSE]: buildTrueFalse,
  [QUESTION_TYPE.WRITTEN]: buildWritten
}

// Tạo quiz.
const generate = async (deckId, userId, config) => {
  await getAccessibleDeck(deckId, userId)

  const cards = await flashcardModel.find({ deckId })
  if (cards.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Bộ thẻ chưa có thẻ học nào.')
  }

  const types = config.types && config.types.length ? config.types : [QUESTION_TYPE.MULTIPLE_CHOICE]

  const needsOtherCards = types.includes(QUESTION_TYPE.MULTIPLE_CHOICE) || types.includes(QUESTION_TYPE.TRUE_FALSE)
  if (needsOtherCards && cards.length < 2) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Cần ít nhất 2 thẻ cho dạng trắc nghiệm hoặc đúng/sai.')
  }

  const user = await userModel.findById(userId).select('defaultQuizSize')
  const limit = config.limit || user?.defaultQuizSize || QUESTION_LIMITS.DEFAULT_QUIZ_LIMIT

  const selected = shuffle(cards).slice(0, limit)
  const questions = selected.map((card, index) => builders[types[index % types.length]](card, cards))

  const attempt = await quizAttemptModel.create({
    userId,
    deckId,
    totalQuestions: questions.length,
    correctCount: 0,
    score: 0,
    startedAt: new Date(),
    submittedAt: null,
    answers: questions.map((q) => ({
      flashcardId: q.flashcardId,
      type: q.type,
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
      selectedAnswer: null,
      isCorrect: false
    }))
  })

  const safeQuestions = questions.map((q, i) => ({
    questionId: attempt.answers[i]._id,
    type: q.type,
    flashcardId: q.flashcardId,
    questionText: q.questionText,
    ...(q.options ? { options: q.options } : {})
  }))

  return { attemptId: attempt._id, startedAt: attempt.startedAt, questions: safeQuestions }
}

// Đánh dấu mỗi lượt đã áp dụng ngay trên document tiến độ để có thể thử lại an toàn.
const saveQuizProgress = async (attempt, userId) => {
  const alreadyApplied = { $in: [attempt._id, { $ifNull: ['$appliedQuizAttempts', []] }] }
  const isLatestReview = { $lte: [{ $ifNull: ['$lastReviewedAt', attempt.gradingAt] }, attempt.gradingAt] }
  const progressOps = attempt.answers.map((answer) => ({
    updateOne: {
      filter: { userId, flashcardId: answer.flashcardId },
      update: [
        {
          $set: {
            status: {
              $cond: [
                { $and: [{ $not: [alreadyApplied] }, isLatestReview] },
                answer.isCorrect ? LEARNING_STATUS.REMEMBERED : LEARNING_STATUS.LEARNING,
                '$status'
              ]
            },
            lastReviewedAt: { $cond: [isLatestReview, attempt.gradingAt, '$lastReviewedAt'] },
            reviewCount: { $add: [{ $ifNull: ['$reviewCount', 0] }, { $cond: [alreadyApplied, 0, 1] }] },
            appliedQuizAttempts: { $setUnion: [{ $ifNull: ['$appliedQuizAttempts', []] }, [attempt._id]] }
          }
        }
      ],
      upsert: true
    }
  }))
  if (!progressOps.length) return
  try {
    await cardProgressModel.bulkWrite(progressOps)
  } catch (error) {
    if (error.code !== 11000) throw error
    await cardProgressModel.bulkWrite(progressOps)
  }
}

// Chấm và nộp quiz.
const submit = async (deckId, userId, { attemptId, answers }) => {
  await getAccessibleDeck(deckId, userId)

  const attemptFilter = { _id: attemptId, userId, deckId }
  const selectedMap = new Map(answers.map((answer) => [answer.questionId, answer.selectedAnswer]))
  let attempt = await quizAttemptModel.findOne(attemptFilter).select('+gradingAt')
  if (!attempt) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy lượt làm bài.')

  if (!attempt.submittedAt && !attempt.gradingAt) {
    const gradedAnswers = attempt.answers.map((answer) => {
      const selectedAnswer = selectedMap.get(answer._id.toString()) ?? null
      return {
        ...answer.toObject(),
        selectedAnswer,
        isCorrect: matchAnswer(selectedAnswer || '', answer.correctAnswer)
      }
    })
    const correctCount = gradedAnswers.filter((answer) => answer.isCorrect).length
    const score = Math.round((correctCount / attempt.totalQuestions) * QUESTION_LIMITS.SCORE_PERCENT_MAX)
    const graded = await quizAttemptModel
      .findOneAndUpdate(
        { ...attemptFilter, submittedAt: null, gradingAt: null },
        { $set: { answers: gradedAnswers, correctCount, score, gradingAt: new Date() } },
        { returnDocument: 'after' }
      )
      .select('+gradingAt')
    attempt = graded ?? (await quizAttemptModel.findOne(attemptFilter).select('+gradingAt'))
  }

  if (
    !attempt ||
    !attempt.answers.every((answer) => answer.selectedAnswer === (selectedMap.get(answer._id.toString()) ?? null))
  ) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy lượt làm bài hoặc bài đã được nộp.')
  }
  if (!attempt.submittedAt) {
    await saveQuizProgress(attempt, userId)
    await recordStudyActivity(userId, STUDY_ACTIVITY_SOURCE.QUIZ, attempt.gradingAt)
    const submitted = await quizAttemptModel.findOneAndUpdate(
      { ...attemptFilter, submittedAt: null },
      { $set: { submittedAt: attempt.gradingAt } },
      { returnDocument: 'after' }
    )
    if (submitted) return submitted
  }
  return quizAttemptModel.findOne(attemptFilter)
}

const getResult = async (deckId, userId, attemptId) => {
  const attempt = await quizAttemptModel
    .findOne({ _id: attemptId, userId, deckId, submittedAt: { $ne: null } })
    .select('totalQuestions correctCount score startedAt submittedAt answers')
    .lean()
  if (!attempt) throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy kết quả bài kiểm tra.')
  return attempt
}

export default { generate, submit, getResult }
