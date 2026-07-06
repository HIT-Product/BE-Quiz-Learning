import { shuffle, normalize } from '../../utils/quiz.js'
import { QUESTION_LIMITS, QUESTION_TYPE, TRUE_FALSE_ANSWER, LEARN_ANSWER_SIDE } from '../../constants/index.js'

// Tạo câu hỏi multiple choice
const buildMultipleChoice = (card, allCards) => {
  const seen = new Set([normalize(card.back)])
  const pick = (arr) =>
    shuffle(arr).filter((answer) => {
      const key = normalize(answer)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

  const own = pick(card.distractors || [])
  const need = QUESTION_LIMITS.MULTIPLE_CHOICE_OPTION_COUNT - 1 - own.length
  const filler =
    need > 0
      ? pick(
        allCards
          .filter((c) => c._id.toString() !== card._id.toString())
          .map((c) => c.back)
      ).slice(0, need)
      : []

  const distractors = [...own, ...filler].slice(0, QUESTION_LIMITS.MULTIPLE_CHOICE_OPTION_COUNT - 1)
  if (distractors.length === 0) return buildWritten(card)

  return {
    type: QUESTION_TYPE.MULTIPLE_CHOICE,
    flashcardId: card._id,
    questionText: card.stem || card.front,
    options: shuffle([card.back, ...distractors]),
    correctAnswer: card.back
  }
}

// Tạo câu hỏi true false
const buildTrueFalse = (card, allCards) => {
  const others = allCards.filter(
    (c) => c._id.toString() !== card._id.toString() && normalize(c.back) !== normalize(card.back)
  )
  const isTrue = others.length === 0 ? true : Math.random() < 0.5
  const shown = isTrue ? card.back : shuffle(others)[0].back

  return {
    type: QUESTION_TYPE.TRUE_FALSE,
    flashcardId: card._id,
    questionText: `"${card.stem || card.front}" có nghĩa là "${shown}"?`,
    statement: shown,
    correctAnswer: isTrue ? TRUE_FALSE_ANSWER.TRUE : TRUE_FALSE_ANSWER.FALSE
  }
}

// Tạo câu hỏi written
const buildWritten = (card) => ({
  type: QUESTION_TYPE.WRITTEN,
  flashcardId: card._id,
  questionText: card.stem || card.front,
  correctAnswer: card.back
})

// Tạo thẻ flashcard
const buildFlashcard = (card) => ({
  type: QUESTION_TYPE.FLASHCARD,
  flashcardId: card._id,
  questionText: card.stem || card.front,
  back: card.back
})

const viewCard = (card, side) =>
  side === LEARN_ANSWER_SIDE.BACK
    ? { _id: card._id, front: card.back, back: card.front, stem: '', distractors: [] }
    : card

export { buildMultipleChoice, buildTrueFalse, buildWritten, buildFlashcard, viewCard }
