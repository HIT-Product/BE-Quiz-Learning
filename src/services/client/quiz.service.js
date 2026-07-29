import { StatusCodes } from 'http-status-codes'

import { DECK_VISIBILITY, LEARNING_STATUS, QUESTION_LIMITS, QUESTION_TYPE } from '../../constants/index.js'
import { deckModel, flashcardModel, quizAttemptModel, cardProgressModel, userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { shuffle, matchAnswer } from '../../utils/quiz.js'
import { buildMultipleChoice, buildTrueFalse, buildWritten } from './question.service.js'

// Kiểm tra quyền truy cập deck
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

// Sinh quiz
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

// Nộp quiz
const submit = async (deckId, userId, payload) => {
  await getAccessibleDeck(deckId, userId)

  const { attemptId, answers } = payload

  const attempt = await quizAttemptModel.findOne({ _id: attemptId, userId, deckId, submittedAt: null })
  if (!attempt) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy lượt làm bài hoặc bài đã được nộp.')
  }

  const selectedMap = new Map(answers.map((a) => [a.questionId, a.selectedAnswer]))

  let correctCount = 0
  for (const ans of attempt.answers) {
    const selected = selectedMap.get(ans._id.toString()) ?? null
    ans.selectedAnswer = selected
    ans.isCorrect = matchAnswer(selected || '', ans.correctAnswer)
    if (ans.isCorrect) correctCount++
  }

  attempt.correctCount = correctCount
  attempt.score = Math.round((correctCount / attempt.totalQuestions) * QUESTION_LIMITS.SCORE_PERCENT_MAX)
  attempt.submittedAt = new Date()
  await attempt.save()

  const progressOps = attempt.answers.map((ans) => ({
    updateOne: {
      filter: { userId, flashcardId: ans.flashcardId },
      update: {
        $set: {
          status: ans.isCorrect ? LEARNING_STATUS.REMEMBERED : LEARNING_STATUS.LEARNING,
          lastReviewedAt: new Date()
        },
        $inc: { reviewCount: 1 },
        $setOnInsert: { userId, flashcardId: ans.flashcardId }
      },
      upsert: true
    }
  }))
  if (progressOps.length > 0) {
    await cardProgressModel.bulkWrite(progressOps)
  }

  return attempt
}

export default { generate, submit }
