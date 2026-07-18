import { StatusCodes } from 'http-status-codes'

import { deckModel, flashcardModel, cardProgressModel, learnSessionModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'
import { matchAnswer, isCloseAnswer } from '../../utils/quiz.js'
import { buildMultipleChoice, buildTrueFalse, buildWritten, buildFlashcard, viewCard } from './question.service.js'
import {
  DECK_VISIBILITY,
  QUESTION_TYPE,
  LEARNING_STATUS,
  LEARN_SESSION_MODE,
  LEARN_SESSION_STATUS,
  LEARN_ANSWER_SIDE,
  LEARN_SCOPE,
  LEARN_OUTCOME,
  LEARN_SESSION_LIMITS,
  WRITTEN_GRADE_MODE
} from '../../constants/index.js'

const LADDER = [QUESTION_TYPE.TRUE_FALSE, QUESTION_TYPE.MULTIPLE_CHOICE, QUESTION_TYPE.WRITTEN]

const MODE_DEFAULTS = {
  [LEARN_SESSION_MODE.CRAM]: {
    blockSize: LEARN_SESSION_LIMITS.CRAM_BLOCK_SIZE,
    activeSetSize: LEARN_SESSION_LIMITS.CRAM_ACTIVE_SET_SIZE,
    masteryTarget: LEARN_SESSION_LIMITS.CRAM_MASTERY_TARGET
  },
  [LEARN_SESSION_MODE.MASTER]: {
    blockSize: LEARN_SESSION_LIMITS.MASTER_BLOCK_SIZE,
    activeSetSize: LEARN_SESSION_LIMITS.MASTER_ACTIVE_SET_SIZE,
    masteryTarget: null // Mặc định theo số bậc.
  }
}

// Truy cập deck
const getAccessibleDeck = async (deckId, userId) => {
  const deck = await deckModel.findById(deckId)
  if (!deck) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay bo the.')
  const isOwner = deck.ownerId.toString() === userId.toString()
  if (!isOwner && deck.visibility !== DECK_VISIBILITY.PUBLIC) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay bo the.')
  }
  return deck
}

// Cấu hình
const activeLadder = (types) => LADDER.filter((t) => types.includes(t))

const masteryTargetFor = (session) => {
  if (session.config.masteryTarget) return session.config.masteryTarget
  const n = activeLadder(session.config.types).length
  return Math.max(1, n)
}

const buildConfig = (mode, input = {}) => {
  const d = MODE_DEFAULTS[mode] || MODE_DEFAULTS[LEARN_SESSION_MODE.MASTER]
  const types = input.types && input.types.length ? input.types : Object.values(QUESTION_TYPE)
  const ladderCount = activeLadder(types).length
  return {
    types,
    answerSide: input.answerSide || LEARN_ANSWER_SIDE.FRONT,
    blockSize: input.blockSize || d.blockSize,
    activeSetSize: input.activeSetSize || d.activeSetSize,
    masteryTarget: d.masteryTarget != null ? d.masteryTarget : Math.max(1, ladderCount),
    sessionLimit: input.sessionLimit || null,
    scope: input.scope || LEARN_SCOPE.ALL,
    writtenGradeMode: input.writtenGradeMode || WRITTEN_GRADE_MODE.MODERATE,
    timeTargetMin: input.timeTargetMin || null
  }
}

// Phạm vi thẻ
// STARRED cần `starred`; HARD dùng status learning.

const scopeFilter = (cards, statusMap, progressMap, scope) => {
  if (scope === LEARN_SCOPE.STARRED) return cards.filter((c) => progressMap.get(c._id.toString())?.starred)
  if (scope === LEARN_SCOPE.UNLEARNED) {
    return cards.filter((c) => (statusMap.get(c._id.toString()) || LEARNING_STATUS.NEW) !== LEARNING_STATUS.REMEMBERED)
  }
  if (scope === LEARN_SCOPE.HARD) {
    return cards.filter((c) => progressMap.get(c._id.toString())?.status === LEARNING_STATUS.LEARNING)
  }
  return cards
}

const loadCards = async (deckId) => flashcardModel.find({ deckId }).sort({ sortOrder: 1, createdAt: 1 })

// Kích hoạt thẻ mới
const activateCards = (session) => {
  const active = session.cards.filter((c) => c.due !== null && !c.mastered).length
  let slots = session.config.activeSetSize - active
  if (slots <= 0) return
  for (const cs of session.cards) {
    if (slots <= 0) break
    if (cs.due === null && !cs.mastered) {
      cs.due = session.step
      slots--
    }
  }
}

// Chọn câu tiếp theo
const selectNext = (session) => {
  const notMastered = session.cards.filter((c) => !c.mastered && c.due !== null)
  if (notMastered.length === 0) return null

  const dueNow = notMastered.filter((c) => c.due <= session.step)
  let pool = dueNow.length > 0 ? dueNow : notMastered

  // Tránh lặp thẻ vừa ra.
  if (pool.length > 1 && session.lastCardId) {
    const filtered = pool.filter((c) => c.flashcardId.toString() !== session.lastCardId.toString())
    if (filtered.length > 0) pool = filtered
  }

  pool.sort((a, b) => a.due - b.due || b.wrongTotal - a.wrongTotal || a.correctTotal - b.correctTotal)
  return pool[0]
}

// Chọn loại câu hỏi
const questionTypeFor = (session, cs) => {
  const ladder = activeLadder(session.config.types)
  const hasFlashcard = session.config.types.includes(QUESTION_TYPE.FLASHCARD)

  // Master hiển thị flashcard trước ladder.
  if (session.mode === LEARN_SESSION_MODE.MASTER && hasFlashcard && !cs.exposed) {
    return QUESTION_TYPE.FLASHCARD
  }
  if (ladder.length === 0) return QUESTION_TYPE.FLASHCARD // chỉ bật flashcard

  if (session.mode === LEARN_SESSION_MODE.CRAM) {
    return ladder.includes(QUESTION_TYPE.MULTIPLE_CHOICE) ? QUESTION_TYPE.MULTIPLE_CHOICE : ladder[0]
  }
  return ladder[Math.min(cs.stage, ladder.length - 1)]
}

// Tạo câu hỏi
const generateQuestion = (session, cs, cardsById, allCards) => {
  const side = session.config.answerSide
  const card = cardsById.get(cs.flashcardId.toString())
  const view = viewCard(card, side)
  const viewAll = side === LEARN_ANSWER_SIDE.BACK ? allCards.map((c) => viewCard(c, side)) : allCards

  const type = questionTypeFor(session, cs)
  let q
  if (type === QUESTION_TYPE.FLASHCARD) q = buildFlashcard(view)
  else if (type === QUESTION_TYPE.TRUE_FALSE) q = buildTrueFalse(view, viewAll)
  else if (type === QUESTION_TYPE.MULTIPLE_CHOICE) q = buildMultipleChoice(view, viewAll)
  else q = buildWritten(view)

  // Multiple choice có thể fallback về written.
  return {
    flashcardId: cs.flashcardId.toString(),
    type: q.type,
    questionText: q.questionText,
    options: q.options || null,
    statement: q.statement || null,
    correctAnswer: q.correctAnswer ?? null,
    back: q.type === QUESTION_TYPE.FLASHCARD ? q.back : undefined,
    answerSide: side
  }
}

const stripCorrect = (cur) => {
  if (!cur) return null
  const { correctAnswer, ...safe } = cur
  return safe
}

const blockInfo = (session) => {
  const size = session.config.blockSize
  return {
    index: Math.floor(session.step / size),
    size,
    positionInBlock: session.step % size,
    blockCompleted: session.step > 0 && session.step % size === 0
  }
}

// Đồng bộ tiến độ
const syncProgress = async (userId, flashcardId, status) => {
  await cardProgressModel.updateOne(
    { userId, flashcardId },
    {
      $set: { status, lastReviewedAt: new Date() },
      $inc: { reviewCount: 1 },
      $setOnInsert: { userId, flashcardId }
    },
    { upsert: true }
  )
}

// Áp dụng kết quả
const applyOutcome = (session, cs, outcome) => {
  const target = masteryTargetFor(session)
  cs.exposed = true

  if (outcome === LEARN_OUTCOME.FLASH_KNOWN) {
    const ladder = activeLadder(session.config.types)
    if (ladder.length === 0) {
      // Không có ladder: hoàn thành ngay.
      cs.correctTotal++
      session.stats.totalCorrect++
      cs.stage = target
      cs.mastered = true
      cs.due = null
    } else {
      // Giữ nguyên stage khi vào ladder.
      cs.due = session.step + LEARN_SESSION_LIMITS.GAP_CORRECT
    }
    return
  }

  if (outcome === LEARN_OUTCOME.FLASH_UNKNOWN) {
    cs.due = session.step + LEARN_SESSION_LIMITS.GAP_DONTKNOW
    return
  }

  if (outcome === LEARN_OUTCOME.CORRECT) {
    cs.correctTotal++
    session.stats.totalCorrect++
    cs.stage = Math.min(cs.stage + 1, target)
    if (cs.stage >= target) {
      cs.mastered = true
      cs.due = null
    } else {
      cs.due = session.step + LEARN_SESSION_LIMITS.GAP_CORRECT
    }
  } else if (outcome === LEARN_OUTCOME.WRONG) {
    cs.wrongTotal++
    session.stats.totalWrong++
    cs.stage = Math.max(0, cs.stage - 1)
    cs.due = session.step + LEARN_SESSION_LIMITS.GAP_WRONG
  } else {
    // Giữ stage và đưa thẻ vào lại sớm.
    cs.wrongTotal++
    session.stats.totalWrong++
    cs.due = session.step + LEARN_SESSION_LIMITS.GAP_DONTKNOW
  }
}

// Chấm câu trả lời
const grade = (session, payload) => {
  const cur = session.current
  const cfg = session.config

  if (payload.dontKnow) {
    return {
      isCorrect: false,
      outcome: LEARN_OUTCOME.DONTKNOW,
      fuzzy: false,
      correctAnswer: cur.correctAnswer
    }
  }

  if (cur.type === QUESTION_TYPE.FLASHCARD) {
    const known = payload.known === true
    return {
      isCorrect: known,
      outcome: known ? LEARN_OUTCOME.FLASH_KNOWN : LEARN_OUTCOME.FLASH_UNKNOWN,
      fuzzy: false,
      correctAnswer: cur.correctAnswer ?? null
    }
  }

  if (cur.type === QUESTION_TYPE.TRUE_FALSE) {
    const ok = String(payload.selectedAnswer || '').toLowerCase() === String(cur.correctAnswer).toLowerCase()
    return {
      isCorrect: ok,
      outcome: ok ? LEARN_OUTCOME.CORRECT : LEARN_OUTCOME.WRONG,
      fuzzy: false,
      correctAnswer: cur.correctAnswer
    }
  }

  if (cur.type === QUESTION_TYPE.MULTIPLE_CHOICE) {
    const ok = matchAnswer(payload.selectedAnswer || '', cur.correctAnswer)
    return {
      isCorrect: ok,
      outcome: ok ? LEARN_OUTCOME.CORRECT : LEARN_OUTCOME.WRONG,
      fuzzy: false,
      correctAnswer: cur.correctAnswer
    }
  }

  const sel = payload.selectedAnswer || ''
  const exact = matchAnswer(sel, cur.correctAnswer)
  const fuzzy =
    !exact &&
    isCloseAnswer(sel, cur.correctAnswer, {
      mode: cfg.writtenGradeMode,
      maxLen: LEARN_SESSION_LIMITS.LEVENSHTEIN_MAX_LEN
    })
  const ok = exact || fuzzy
  return {
    isCorrect: ok,
    outcome: ok ? LEARN_OUTCOME.CORRECT : LEARN_OUTCOME.WRONG,
    fuzzy,
    correctAnswer: cur.correctAnswer
  }
}

const buildSummary = (session, cardsById) => {
  const totalAnswered = session.step
  const totalCorrect = session.stats.totalCorrect
  const hardest = [...session.cards]
    .filter((c) => c.wrongTotal > 0)
    .sort((a, b) => b.wrongTotal - a.wrongTotal)
    .slice(0, LEARN_SESSION_LIMITS.HARDEST_CARDS_COUNT)
    .map((c) => ({
      flashcardId: c.flashcardId,
      front: cardsById.get(c.flashcardId.toString())?.front,
      wrongTotal: c.wrongTotal
    }))
  return {
    totalCards: session.cards.length,
    totalAnswered,
    accuracy: totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
    hardestCards: hardest,
    durationSec: Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)
  }
}

const cardsMap = async (deckId) => {
  const all = await loadCards(deckId)
  return { all, byId: new Map(all.map((c) => [c._id.toString(), c])) }
}

// Bỏ qua thẻ đã bị xóa.
const issueNext = (session, cmap) => {
  while (true) {
    const cs = selectNext(session)
    if (!cs) {
      session.current = null
      return
    }
    const card = cmap.byId.get(cs.flashcardId.toString())
    if (!card) {
      cs.mastered = true
      cs.due = null
      continue
    }
    session.current = generateQuestion(session, cs, cmap.byId, cmap.all)
    return
  }
}

const masteryProgress = (session) => {
  const mastered = session.cards.filter((c) => c.mastered).length
  return { mastered, total: session.cards.length }
}

const present = (session, cmap) => ({
  sessionId: session._id,
  mode: session.mode,
  config: session.config,
  status: session.status,
  progress: masteryProgress(session),
  block: blockInfo(session),
  current: stripCorrect(session.current)
})

const startOrResume = async (deckId, userId, { mode = LEARN_SESSION_MODE.MASTER, config } = {}) => {
  await getAccessibleDeck(deckId, userId)

  const existing = await learnSessionModel.findOne({ userId, deckId, status: LEARN_SESSION_STATUS.IN_PROGRESS })
  if (existing) {
    return present(existing, await cardsMap(deckId))
  }

  const cards = await loadCards(deckId)
  if (cards.length === 0) throw new ApiError(StatusCodes.BAD_REQUEST, 'Bo the chua co the hoc nao.')

  const progresses = await cardProgressModel.find({ userId, flashcardId: { $in: cards.map((c) => c._id) } })
  const statusMap = new Map(progresses.map((p) => [p.flashcardId.toString(), p.status]))
  const progressMap = new Map(progresses.map((p) => [p.flashcardId.toString(), p]))

  const cfg = buildConfig(mode, config)
  let pool = scopeFilter(cards, statusMap, progressMap, cfg.scope)
  if (pool.length === 0) pool = cards
  if (cfg.sessionLimit) pool = pool.slice(0, cfg.sessionLimit)

  const needsMcOrTf = cfg.types.includes(QUESTION_TYPE.MULTIPLE_CHOICE) || cfg.types.includes(QUESTION_TYPE.TRUE_FALSE)
  if (needsMcOrTf && pool.length < LEARN_SESSION_LIMITS.MIN_CARDS_FOR_MC_OR_TF) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Can it nhat 2 the cho dang trac nghiem hoac dung/sai.')
  }

  const cmap = { all: cards, byId: new Map(cards.map((c) => [c._id.toString(), c])) }

  // Xử lý hai request tạo session cùng lúc.
  let session
  try {
    session = await learnSessionModel.create({
      userId,
      deckId,
      mode,
      config: cfg,
      cards: pool.map((c) => ({ flashcardId: c._id })),
      step: 0,
      stats: { totalCorrect: 0, totalWrong: 0 },
      status: LEARN_SESSION_STATUS.IN_PROGRESS,
      startedAt: new Date()
    })
  } catch (e) {
    if (e.code === 11000) {
      const again = await learnSessionModel.findOne({ userId, deckId, status: LEARN_SESSION_STATUS.IN_PROGRESS })
      if (again) return present(again, cmap)
    }
    throw e
  }

  activateCards(session)
  issueNext(session, cmap)
  await session.save()

  return present(session, cmap)
}

const getCurrent = async (deckId, userId) => {
  await getAccessibleDeck(deckId, userId)
  const session = await learnSessionModel.findOne({ userId, deckId, status: LEARN_SESSION_STATUS.IN_PROGRESS })
  if (!session) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong co phien hoc dang chay.')
  return present(session, await cardsMap(deckId))
}

const answer = async (deckId, userId, payload) => {
  await getAccessibleDeck(deckId, userId)
  const session = await learnSessionModel.findOne({ userId, deckId, status: LEARN_SESSION_STATUS.IN_PROGRESS })
  if (!session) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong co phien hoc dang chay.')
  if (!session.current) throw new ApiError(StatusCodes.BAD_REQUEST, 'Khong co cau hoi dang cho.')

  if (payload.flashcardId && payload.flashcardId !== session.current.flashcardId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Cau tra loi khong khop cau hoi hien tai.')
  }

  const cs = session.cards.find((c) => c.flashcardId.toString() === session.current.flashcardId)
  const result = grade(session, payload)

  const stageBefore = cs.stage
  applyOutcome(session, cs, result.outcome)
  session.lastCardId = cs.flashcardId
  session.lastGraded = {
    flashcardId: cs.flashcardId.toString(),
    outcome: result.outcome,
    stageBefore
  }
  session.step++

  if (cs.mastered) await syncProgress(userId, cs.flashcardId, LEARNING_STATUS.REMEMBERED)
  else if (result.outcome !== LEARN_OUTCOME.CORRECT)
    await syncProgress(userId, cs.flashcardId, LEARNING_STATUS.LEARNING)

  const cmap = await cardsMap(deckId)

  activateCards(session)
  const done = session.cards.every((c) => c.mastered)

  let summary = null
  if (done) {
    session.status = LEARN_SESSION_STATUS.COMPLETED
    session.completedAt = new Date()
    session.current = null
    summary = buildSummary(session, cmap.byId)
  } else {
    issueNext(session, cmap)
  }

  // Mongoose không tự nhận thay đổi của Mixed fields.
  session.markModified('current')
  session.markModified('lastGraded')
  await session.save()

  const card = cmap.byId.get(cs.flashcardId.toString())
  return {
    isCorrect: result.isCorrect,
    fuzzy: result.fuzzy,
    correctAnswer: result.correctAnswer,
    card: card ? { front: card.front, back: card.back } : null,
    mastered: cs.mastered,
    progress: masteryProgress(session),
    block: blockInfo(session),
    next: stripCorrect(session.current),
    summary
  }
}

const override = async (deckId, userId) => {
  await getAccessibleDeck(deckId, userId)
  const session = await learnSessionModel.findOne({ userId, deckId, status: LEARN_SESSION_STATUS.IN_PROGRESS })
  if (!session) throw new ApiError(StatusCodes.NOT_FOUND, 'Khong co phien hoc dang chay.')

  const lg = session.lastGraded
  if (!lg || lg.outcome === LEARN_OUTCOME.CORRECT) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Khong co cau vua cham sai de ghi nhan dung.')
  }

  const cs = session.cards.find((c) => c.flashcardId.toString() === lg.flashcardId)
  if (!cs) throw new ApiError(StatusCodes.BAD_REQUEST, 'Khong tim thay the.')

  cs.wrongTotal = Math.max(0, cs.wrongTotal - 1)
  session.stats.totalWrong = Math.max(0, session.stats.totalWrong - 1)
  cs.stage = lg.stageBefore

  applyOutcome(session, cs, LEARN_OUTCOME.CORRECT)
  lg.outcome = LEARN_OUTCOME.CORRECT

  if (cs.mastered) await syncProgress(userId, cs.flashcardId, LEARNING_STATUS.REMEMBERED)

  const done = session.cards.every((c) => c.mastered)
  if (done) {
    session.status = LEARN_SESSION_STATUS.COMPLETED
    session.completedAt = new Date()
    session.current = null
  }

  session.markModified('lastGraded')
  await session.save()
  return present(session, await cardsMap(deckId))
}

const reset = async (deckId, userId, { restart = false, mode, config } = {}) => {
  await getAccessibleDeck(deckId, userId)
  await learnSessionModel.deleteOne({ userId, deckId, status: LEARN_SESSION_STATUS.IN_PROGRESS })
  if (restart) return startOrResume(deckId, userId, { mode, config })
  return { reset: true }
}

export default { startOrResume, getCurrent, answer, override, reset }
