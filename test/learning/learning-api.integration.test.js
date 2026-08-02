import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

import envConfig from '../../src/configs/env.config.js'
import {
  cardProgressModel,
  deckModel,
  flashcardModel,
  learnSessionModel,
  quizAttemptModel,
  sessionModel,
  studyActivityModel,
  userModel
} from '../../src/models/index.js'

const enabled = process.env.RUN_LEARNING_INTEGRATION === 'true'
const baseUrl = process.env.LEARNING_API_BASE_URL || 'http://localhost:3000/api/v1'

let user
let session
let deck
let emptyDeck
let duplicateAnswerDeck
let otherUser
let otherSession
let cards = []
let duplicateAnswerCards = []
let token
let otherToken

const api = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  })
  const json = await response.json()
  return { response, json }
}

before(async () => {
  if (!enabled) return
  await mongoose.connect(envConfig.mongo.uri, { retryWrites: false })

  const suffix = `${Date.now()}-${process.pid}`
  user = await userModel.create({
    email: `learning-smoke-${suffix}@example.test`,
    passwordHash: 'integration-test-only',
    displayName: 'Learning Smoke Test',
    defaultQuizSize: 4
  })
  session = await sessionModel.create({
    userId: user._id,
    tokenHash: `learning-smoke-${suffix}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  })
  deck = await deckModel.create({
    ownerId: user._id,
    title: `Learning smoke ${suffix}`,
    visibility: 'private',
    cardCount: 4
  })
  emptyDeck = await deckModel.create({
    ownerId: user._id,
    title: `Empty learning smoke ${suffix}`,
    visibility: 'private',
    cardCount: 0
  })
  duplicateAnswerDeck = await deckModel.create({
    ownerId: user._id,
    title: `Duplicate-answer learning smoke ${suffix}`,
    visibility: 'private',
    cardCount: 2
  })
  otherUser = await userModel.create({
    email: `learning-smoke-other-${suffix}@example.test`,
    passwordHash: 'integration-test-only',
    displayName: 'Other Learning Smoke Test'
  })
  otherSession = await sessionModel.create({
    userId: otherUser._id,
    tokenHash: `learning-smoke-other-${suffix}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  })
  cards = await flashcardModel.create([
    { deckId: deck._id, front: 'hello', back: 'xin chao', sortOrder: 0 },
    { deckId: deck._id, front: 'goodbye', back: 'tam biet', sortOrder: 1 },
    { deckId: deck._id, front: 'thanks', back: 'cam on', sortOrder: 2 },
    { deckId: deck._id, front: 'sorry', back: 'xin loi', sortOrder: 3 }
  ])
  duplicateAnswerCards = await flashcardModel.create([
    { deckId: duplicateAnswerDeck._id, front: 'same one', back: 'giong nhau', sortOrder: 0 },
    { deckId: duplicateAnswerDeck._id, front: 'same two', back: 'giong nhau', sortOrder: 1 }
  ])
  token = jwt.sign(
    { _id: user._id, email: user.email, sessionId: session._id.toString() },
    envConfig.jwt.secretLogin,
    { expiresIn: envConfig.jwt.expiresInLogin }
  )
  otherToken = jwt.sign(
    { _id: otherUser._id, email: otherUser.email, sessionId: otherSession._id.toString() },
    envConfig.jwt.secretLogin,
    { expiresIn: envConfig.jwt.expiresInLogin }
  )
})

after(async () => {
  if (!enabled || !user) return

  const cardIds = cards.map((card) => card._id)
  const duplicateAnswerCardIds = duplicateAnswerCards.map((card) => card._id)
  await Promise.all([
    cardProgressModel.deleteMany({ userId: user._id, flashcardId: { $in: cardIds } }),
    learnSessionModel.deleteMany({ userId: user._id, deckId: deck._id }),
    quizAttemptModel.deleteMany({ userId: user._id, deckId: deck._id }),
    studyActivityModel.deleteMany({ userId: user._id }),
    flashcardModel.deleteMany({ _id: { $in: cardIds }, deckId: deck._id }),
    flashcardModel.deleteMany({ _id: { $in: duplicateAnswerCardIds }, deckId: duplicateAnswerDeck._id }),
    deckModel.deleteOne({ _id: deck._id, ownerId: user._id }),
    deckModel.deleteOne({ _id: emptyDeck._id, ownerId: user._id }),
    deckModel.deleteOne({ _id: duplicateAnswerDeck._id, ownerId: user._id }),
    sessionModel.deleteOne({ _id: session._id, userId: user._id }),
    sessionModel.deleteOne({ _id: otherSession._id, userId: otherUser._id })
  ])
  await userModel.deleteMany({ _id: { $in: [user._id, otherUser._id] } })
  await mongoose.disconnect()
})

test('learning APIs work together end to end', { skip: !enabled }, async () => {
  const deckId = deck._id.toString()
  const answerByCardId = new Map(cards.map((card) => [card._id.toString(), card.back]))

  const unauthorized = await fetch(`${baseUrl}/decks/${deckId}/study`)
  assert.equal(unauthorized.status, 401)

  const invalidDeckId = await api('/decks/not-an-object-id/learn')
  assert.equal(invalidDeckId.response.status, 400)

  const privateDeck = await api(`/decks/${deckId}/study`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  })
  assert.equal(privateDeck.response.status, 404)

  const invalidFlashcardFlag = await api(`/decks/${deckId}/learn?includeFlashcard=not-a-boolean`)
  assert.equal(invalidFlashcardFlag.response.status, 400)

  const emptyStudy = await api(`/decks/${emptyDeck._id}/study`)
  assert.equal(emptyStudy.response.status, 200)
  assert.equal(emptyStudy.json.data.sessionSize, 0)

  const emptyQuiz = await api(`/decks/${emptyDeck._id}/quiz`, {
    method: 'POST',
    body: JSON.stringify({ types: ['written'], limit: 1 })
  })
  assert.equal(emptyQuiz.response.status, 400)

  const emptyLearn = await api(`/decks/${emptyDeck._id}/learn`)
  assert.equal(emptyLearn.response.status, 400)

  const emptyLearnSession = await api(`/decks/${emptyDeck._id}/learn/session`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'master', config: { types: ['written'] } })
  })
  assert.equal(emptyLearnSession.response.status, 400)

  const noDistractorSession = await api(`/decks/${duplicateAnswerDeck._id}/learn/session`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'master', config: { types: ['multiple_choice', 'true_false', 'written'] } })
  })
  assert.equal(noDistractorSession.response.status, 400)

  const study = await api(`/decks/${deckId}/study?filter=all`)
  assert.equal(study.response.status, 200)
  assert.equal(study.json.data.sessionSize, 4)
  assert.equal(study.json.data.summary.new, 4)

  const learningReview = await api(`/decks/${deckId}/study/cards/${cards[0]._id}/review`, {
    method: 'POST',
    body: JSON.stringify({ remembered: false })
  })
  assert.equal(learningReview.response.status, 200)
  assert.equal(learningReview.json.data.status, 'learning')

  const rememberedReview = await api(`/decks/${deckId}/study/cards/${cards[0]._id}/review`, {
    method: 'POST',
    body: JSON.stringify({ remembered: true })
  })
  assert.equal(rememberedReview.response.status, 200)
  assert.equal(rememberedReview.json.data.status, 'remembered')
  assert.equal(rememberedReview.json.data.reviewCount, 2)

  const quiz = await api(`/decks/${deckId}/quiz`, {
    method: 'POST',
    body: JSON.stringify({ types: ['multiple_choice', 'true_false', 'written'], limit: 4 })
  })
  assert.equal(quiz.response.status, 200)
  assert.equal(quiz.json.data.questions.length, 4)
  assert.ok(quiz.json.data.questions.every((question) => !('correctAnswer' in question)))

  const quizSubmit = await api(`/decks/${deckId}/quiz/submit`, {
    method: 'POST',
    body: JSON.stringify({
      attemptId: quiz.json.data.attemptId,
      answers: quiz.json.data.questions.map((question) => ({ questionId: question.questionId, selectedAnswer: '' }))
    })
  })
  assert.equal(quizSubmit.response.status, 201)
  assert.equal(quizSubmit.json.data.totalQuestions, 4)
  assert.ok(quizSubmit.json.data.score >= 0 && quizSubmit.json.data.score <= 100)

  const duplicateSubmit = await api(`/decks/${deckId}/quiz/submit`, {
    method: 'POST',
    body: JSON.stringify({
      attemptId: quiz.json.data.attemptId,
      answers: [{ questionId: quiz.json.data.questions[0].questionId, selectedAnswer: '' }]
    })
  })
  assert.equal(duplicateSubmit.response.status, 404)

  await cardProgressModel.deleteMany({ userId: user._id, flashcardId: { $in: cards.map((card) => card._id) } })

  const round = await api(
    `/decks/${deckId}/learn?limit=4&onlyUnlearned=false&includeFlashcard=false&types=multiple_choice,true_false,written`
  )
  assert.equal(round.response.status, 200)
  assert.equal(round.json.data.questions.length, 4)
  assert.ok(round.json.data.questions.every((question) => question.type !== 'flashcard'))
  assert.ok(round.json.data.questions.every((question) => !('correctAnswer' in question)))

  const writtenRound = await api(
    `/decks/${deckId}/learn?limit=1&onlyUnlearned=false&includeFlashcard=false&types=written`
  )
  const writtenQuestion = writtenRound.json.data.questions[0]
  const learnAnswer = await api(`/decks/${deckId}/learn/answer`, {
    method: 'POST',
    body: JSON.stringify({
      flashcardId: writtenQuestion.flashcardId,
      type: 'written',
      selectedAnswer: answerByCardId.get(writtenQuestion.flashcardId)
    })
  })
  assert.equal(learnAnswer.response.status, 200)
  assert.equal(learnAnswer.json.data.isCorrect, true)

  const startSession = await api(`/decks/${deckId}/learn/session`, {
    method: 'POST',
    body: JSON.stringify({
      mode: 'master',
      config: { types: ['written'], sessionLimit: 1, activeSetSize: 1, blockSize: 1 }
    })
  })
  assert.equal(startSession.response.status, 200)
  assert.equal(startSession.json.data.current.type, 'written')

  const wrongAnswer = await api(`/decks/${deckId}/learn/session/answer`, {
    method: 'POST',
    body: JSON.stringify({ flashcardId: startSession.json.data.current.flashcardId, selectedAnswer: 'wrong-answer' })
  })
  assert.equal(wrongAnswer.response.status, 200)
  assert.equal(wrongAnswer.json.data.isCorrect, false)

  const override = await api(`/decks/${deckId}/learn/session/override`, { method: 'POST', body: '{}' })
  assert.equal(override.response.status, 200)
  assert.equal(override.json.data.status, 'completed')

  const reset = await api(`/decks/${deckId}/learn/session/reset`, {
    method: 'POST',
    body: JSON.stringify({ restart: true, mode: 'cram', config: { types: ['flashcard'], sessionLimit: 1 } })
  })
  assert.equal(reset.response.status, 200)
  assert.equal(reset.json.data.mode, 'cram')
  assert.equal(reset.json.data.current.type, 'flashcard')

  const flashcardAnswer = await api(`/decks/${deckId}/learn/session/answer`, {
    method: 'POST',
    body: JSON.stringify({ flashcardId: reset.json.data.current.flashcardId, known: true })
  })
  assert.equal(flashcardAnswer.response.status, 200)
  assert.equal(flashcardAnswer.json.data.isCorrect, true)
  assert.ok(flashcardAnswer.json.data.summary)

  const currentAfterCompletion = await api(`/decks/${deckId}/learn/session`)
  assert.equal(currentAfterCompletion.response.status, 404)

  const finalReset = await api(`/decks/${deckId}/learn/session/reset`, {
    method: 'POST',
    body: JSON.stringify({ restart: false, resetProgress: true })
  })
  assert.equal(finalReset.response.status, 200)
  assert.equal(finalReset.json.data.reset, true)
  assert.equal(finalReset.json.data.progressReset, true)
  assert.equal(await cardProgressModel.countDocuments({ userId: user._id, flashcardId: { $in: cards.map((card) => card._id) } }), 0)

  const orderedConfig = {
    types: ['multiple_choice', 'true_false', 'written'],
    sessionLimit: 2,
    activeSetSize: 2,
    blockSize: 6
  }
  const orderedStart = await api(`/decks/${deckId}/learn/session`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'master', config: orderedConfig })
  })
  assert.equal(orderedStart.response.status, 200)
  assert.equal(orderedStart.json.data.current.type, 'multiple_choice')

  const observedTypes = []
  let currentQuestion = orderedStart.json.data.current
  while (currentQuestion) {
    observedTypes.push(currentQuestion.type)
    const answer =
      currentQuestion.type === 'true_false'
        ? currentQuestion.statement === answerByCardId.get(currentQuestion.flashcardId)
          ? 'true'
          : 'false'
        : answerByCardId.get(currentQuestion.flashcardId)
    const result = await api(`/decks/${deckId}/learn/session/answer`, {
      method: 'POST',
      body: JSON.stringify({ flashcardId: currentQuestion.flashcardId, selectedAnswer: answer })
    })
    assert.equal(result.response.status, 200)
    currentQuestion = result.json.data.next
  }
  assert.deepEqual(observedTypes, [
    'multiple_choice',
    'multiple_choice',
    'true_false',
    'true_false',
    'written',
    'written'
  ])

  const resetOrderedSession = await api(`/decks/${deckId}/learn/session/reset`, {
    method: 'POST',
    body: JSON.stringify({ restart: true, mode: 'master', config: orderedConfig })
  })
  assert.equal(resetOrderedSession.response.status, 200)
  assert.equal(resetOrderedSession.json.data.current.type, 'multiple_choice')

  const retypeSession = await api(`/decks/${deckId}/learn/session/reset`, {
    method: 'POST',
    body: JSON.stringify({
      restart: true,
      mode: 'master',
      config: {
        types: ['written'],
        sessionLimit: 1,
        activeSetSize: 1,
        blockSize: 1,
        retypeWrongAnswers: true
      }
    })
  })
  assert.equal(retypeSession.response.status, 200)
  assert.equal(retypeSession.json.data.config.retypeWrongAnswers, true)

  const retypeCardId = retypeSession.json.data.current.flashcardId
  const wrongBeforeRetype = await api(`/decks/${deckId}/learn/session/answer`, {
    method: 'POST',
    body: JSON.stringify({ flashcardId: retypeCardId, selectedAnswer: 'wrong-answer' })
  })
  assert.equal(wrongBeforeRetype.response.status, 200)
  assert.equal(wrongBeforeRetype.json.data.retypeRequired, true)
  assert.equal(wrongBeforeRetype.json.data.next, null)
  assert.equal(wrongBeforeRetype.json.data.retype.correctAnswer, answerByCardId.get(retypeCardId))

  const currentDuringRetype = await api(`/decks/${deckId}/learn/session`)
  assert.equal(currentDuringRetype.response.status, 200)
  assert.equal(currentDuringRetype.json.data.current, null)
  assert.equal(currentDuringRetype.json.data.retype.required, true)

  const rejectedRetype = await api(`/decks/${deckId}/learn/session/retype`, {
    method: 'POST',
    body: JSON.stringify({ flashcardId: retypeCardId, typedAnswer: 'still-wrong' })
  })
  assert.equal(rejectedRetype.response.status, 200)
  assert.equal(rejectedRetype.json.data.accepted, false)
  assert.equal(rejectedRetype.json.data.retypeRequired, true)

  const acceptedRetype = await api(`/decks/${deckId}/learn/session/retype`, {
    method: 'POST',
    body: JSON.stringify({ flashcardId: retypeCardId, typedAnswer: answerByCardId.get(retypeCardId) })
  })
  assert.equal(acceptedRetype.response.status, 200)
  assert.equal(acceptedRetype.json.data.accepted, true)
  assert.equal(acceptedRetype.json.data.retypeRequired, false)
  assert.ok(acceptedRetype.json.data.next)

  const lateOverride = await api(`/decks/${deckId}/learn/session/override`, { method: 'POST', body: '{}' })
  assert.equal(lateOverride.response.status, 400)
})
