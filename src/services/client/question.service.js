import { shuffle, normalize } from '../../utils/quiz.js'

const MC_OPTION_COUNT = 4

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

  if (distractors.length === 0) return buildWritten(card)

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
    statement: shown,
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

// Tao the flashcard
const buildFlashcard = (card) => ({
  type: 'flashcard',
  flashcardId: card._id,
  questionText: card.front,
  back: card.back
})

export { buildMultipleChoice, buildTrueFalse, buildWritten, buildFlashcard }
