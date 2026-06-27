import { StatusCodes } from 'http-status-codes'

import { deckModel, flashcardModel, quizAttemptModel, cardProgressModel, userModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { shuffle, normalize } from '../../utils/quiz.js'

const MC_OPTION_COUNT = 4

// Kiem tra quyen truy cap deck
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== 'public') {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Tao cau hoi multiple choice
const buildMultipleChoice = (card, allCards) => {
  const candidates = [
    ...(card.distractors || []),
    ...allCards.filter((c) => c._id.toString() !== card._id.toString()).map((c) => c.back)
  ]
  const seen = new Set([normalize(card.back)])
  const distractors = shuffle(candidates)
    .filter((answer) => {
      const key = normalize(answer)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MC_OPTION_COUNT - 1)

  if (distractors.length === 0) {
    return buildWritten(card)
  }

  return {
    type: 'multiple_choice',
    flashcardId: card._id,
    questionText: card.front,
    options: shuffle([card.back, ...distractors]),
    correctAnswer: card.back
  }
}

// Tao cau hoi true false
const buildTrueFalse = (card, allCards) => {
  const others = allCards.filter(
    (c) => c._id.toString() !== card._id.toString() && normalize(c.back) !== normalize(card.back)
  )
  const isTrue = others.length === 0 ? true : Math.random() < 0.5
  const shown = isTrue ? card.back : shuffle(others)[0].back

  return {
    type: 'true_false',
    flashcardId: card._id,
    questionText: `"${card.front}" có nghĩa là "${shown}"?`,
    correctAnswer: isTrue ? 'true' : 'false'
  }
}

// Tao cau hoi written
const buildWritten = (card) => ({
  type: 'written',
  flashcardId: card._id,
  questionText: card.front,
  correctAnswer: card.back
})

const builders = {
  multiple_choice: buildMultipleChoice,
  true_false: buildTrueFalse,
  written: buildWritten
}

// Sinh quiz
const generate = async (deckId, userId, config) => {
  await getAccessibleDeck(deckId, userId)

  const cards = await flashcardModel.find({ deckId })
  if (cards.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Bộ thẻ chưa có thẻ học nào.')
  }

  const types = config.types && config.types.length ? config.types : ['multiple_choice']

  const needsOtherCards = types.includes('multiple_choice') || types.includes('true_false')
  if (needsOtherCards && cards.length < 2) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Cần ít nhất 2 thẻ cho dạng trắc nghiệm hoặc đúng/sai.')
  }

  const user = await userModel.findById(userId).select('defaultQuizSize')
  const limit = config.limit || user?.defaultQuizSize || 10

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

// Nop quiz
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
    ans.isCorrect = normalize(selected || '') === normalize(ans.correctAnswer)
    if (ans.isCorrect) correctCount++
  }

  attempt.correctCount = correctCount
  attempt.score = Math.round((correctCount / attempt.totalQuestions) * 100)
  attempt.submittedAt = new Date()
  await attempt.save()

  const progressOps = attempt.answers.map((ans) => ({
    updateOne: {
      filter: { userId, flashcardId: ans.flashcardId },
      update: {
        $set: { status: ans.isCorrect ? 'remembered' : 'learning', lastReviewedAt: new Date() },
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
