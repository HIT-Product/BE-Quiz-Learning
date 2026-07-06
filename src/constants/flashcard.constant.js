const FLASHCARD_TYPE = {
  BASIC: 'basic',
  MULTIPLE_CHOICE: 'multiple_choice'
}

const FLASHCARD_TYPES = Object.values(FLASHCARD_TYPE)

const FLASHCARD_SOURCE = {
  MANUAL: 'manual',
  IMPORT: 'import',
  COPY: 'copy'
}

const FLASHCARD_SOURCES = Object.values(FLASHCARD_SOURCE)

export { FLASHCARD_TYPE, FLASHCARD_TYPES, FLASHCARD_SOURCE, FLASHCARD_SOURCES }
