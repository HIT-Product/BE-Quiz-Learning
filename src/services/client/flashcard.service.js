import { StatusCodes } from 'http-status-codes'
import Papa from 'papaparse'

import { ApiError } from '../../utils/index.js'
import { deckModel, flashcardModel } from '../../models/index.js'
import { stripOptionPrefix, matchAnswer } from '../../utils/quiz.js'
import { IMPORT_LIMITS, IMPORT_DELIMITER, OPTION_LINE_PATTERN, FLASHCARD_TYPE, FLASHCARD_SOURCE } from '../../constants/index.js'

// Kiểm tra deck sở hữu
const assertOwnedDeck = async (deckId, ownerId) => {
  const deck = await deckModel.findOne({ _id: deckId, ownerId })
  if (!deck) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy bộ thẻ.')
  }
  return deck
}

// Đồng bộ số lượng flashcard
const syncCardCount = async (deckId) => {
  const count = await flashcardModel.countDocuments({ deckId })
  await deckModel.updateOne({ _id: deckId }, { cardCount: count })
  return count
}

// Lấy danh sách flashcard
const list = async (deckId, ownerId) => {
  await assertOwnedDeck(deckId, ownerId)
  return flashcardModel.find({ deckId }).sort({ sortOrder: 1, createdAt: 1 })
}

// Tạo flashcard
const create = async (deckId, ownerId, { front, back, sortOrder, distractors }) => {
  await assertOwnedDeck(deckId, ownerId)

  let order = sortOrder
  if (order === undefined) {
    const last = await flashcardModel.findOne({ deckId }).sort({ sortOrder: -1 })
    order = last ? last.sortOrder + 1 : 0
  }

  const manual = Array.isArray(distractors) ? distractors.filter(Boolean) : []
  let finalBack = stripOptionPrefix(back) // Luôn làm sạch (fix R1)

  let stem = ''
  let finalDistractors = manual
  let cardType = manual.length > 0 ? FLASHCARD_TYPE.MULTIPLE_CHOICE : FLASHCARD_TYPE.BASIC

  if (manual.length === 0) {
    const mc = extractMC(front, back)
    stem = mc.stem
    finalBack = mc.back
    finalDistractors = mc.distractors
    cardType = mc.cardType
  }

  const card = await flashcardModel.create({
    deckId,
    front,
    back: finalBack,
    stem,
    distractors: finalDistractors,
    cardType,
    sortOrder: order,
    source: FLASHCARD_SOURCE.MANUAL
  })
  await syncCardCount(deckId)
  return card
}

// Cập nhật flashcard
const update = async (deckId, cardId, ownerId, payload) => {
  await assertOwnedDeck(deckId, ownerId)

  const card = await flashcardModel.findOne({ _id: cardId, deckId })
  if (!card) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Khong tim thay the hoc.')
  }

  Object.assign(card, payload)

  const manual = Array.isArray(payload.distractors) ? payload.distractors.filter(Boolean) : null
  const touchedFrontOrBack = payload.front !== undefined || payload.back !== undefined

  if (manual && manual.length > 0) {
    card.back = stripOptionPrefix(card.back) // fix R1: đồng nhất khi manual
    card.distractors = manual
    card.cardType = FLASHCARD_TYPE.MULTIPLE_CHOICE
  } else if (touchedFrontOrBack) {
    const mc = extractMC(card.front, card.back)
    card.stem = mc.stem
    card.back = mc.back
    card.distractors = mc.distractors
    card.cardType = mc.cardType
  }

  await card.save()
  return card
}

// Xoá flashcard
const remove = async (deckId, cardId, ownerId) => {
  await assertOwnedDeck(deckId, ownerId)

  const result = await flashcardModel.deleteOne({ _id: cardId, deckId })
  if (result.deletedCount === 0) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thẻ học.')
  }

  await syncCardCount(deckId)
}

// Sắp xếp flashcard
const reorder = async (deckId, ownerId, orderedIds) => {
  await assertOwnedDeck(deckId, ownerId)

  const operations = orderedIds.map((cardId, index) => ({
    updateOne: {
      filter: { _id: cardId, deckId },
      update: { sortOrder: index }
    }
  }))

  await flashcardModel.bulkWrite(operations)
  return flashcardModel.find({ deckId }).sort({ sortOrder: 1 })
}

const cleanCell = (v) => String(v ?? '').trim()
const normalizeAnswer = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

// fix #5: map keyword delimiter sang ký tự thực
const resolveDelimiter = (d) => {
  if (d === IMPORT_DELIMITER.AUTO) return ''
  if (d === IMPORT_DELIMITER.TAB) return IMPORT_DELIMITER.TAB_CHAR
  return d
}

// So khớp back với option MC. Trả về back "sạch" (đã strip prefix) và distractors.
const extractMC = (front, back) => {
  const { stem, options } = parseFrontMC(front)
  if (options.length < IMPORT_LIMITS.MIN_MULTIPLE_CHOICE_OPTIONS) {
    return { stem: '', back, distractors: [], cardType: FLASHCARD_TYPE.BASIC }
  }

  const correct = options.find((opt) => matchAnswer(opt, back))
  if (!correct) {
    return { stem: '', back, distractors: [], cardType: FLASHCARD_TYPE.BASIC }
  }

  const seen = new Set([normalizeAnswer(correct)])
  const distractors = options
    .filter((opt) => {
      const key = normalizeAnswer(opt)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .filter((opt) => opt.length <= IMPORT_LIMITS.MAX_DISTRACTOR_LENGTH)
    .slice(0, IMPORT_LIMITS.MAX_DISTRACTORS)

  // Lưu back đã strip prefix cho đồng nhất với distractor
  return {
    stem,
    back: stripOptionPrefix(correct),
    distractors,
    cardType: distractors.length > 0 ? FLASHCARD_TYPE.MULTIPLE_CHOICE : FLASHCARD_TYPE.BASIC
  }
}

// Nhận diện block trắc nghiệm trong front
const parseFrontMC = (front) => {
  const lines = front.split('\n').slice(0, IMPORT_LIMITS.MAX_LINES_PER_FRONT)
  const options = []
  let firstOptionIdx = -1

  lines.forEach((line, i) => {
    const m = line.match(OPTION_LINE_PATTERN)
    if (m) {
      if (firstOptionIdx === -1) firstOptionIdx = i
      options.push(cleanCell(m[1]))
    }
  })

  if (options.length < IMPORT_LIMITS.MIN_MULTIPLE_CHOICE_OPTIONS) return { stem: '', options: [] }

  const stem = lines.slice(0, firstOptionIdx).join('\n').trim()
  return { stem, options }
}

// Wrapper PapaParse: tách riêng để test
const parseCsv = (rawText, options) => {
  const delimiter = resolveDelimiter(options.delimiter)
  const hasHeader = options.hasHeader !== false

  const result = Papa.parse(rawText, {
    delimiter,
    skipEmptyLines: 'greedy',
    preview: IMPORT_LIMITS.MAX_IMPORT_ROWS + (hasHeader ? 2 : 1)
  })

  if (result.errors?.some((e) => e.type === 'Delimiter')) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Không xác định được dấu phân cách. Hãy chọn delimiter cụ thể.'
    )
  }

  return { rows: result.data, detectedDelimiter: result.meta?.delimiter || delimiter }
}

// Bước 1: trả headers và sample rows để FE build column picker
// fix #6: kiểm tra sở hữu deck trước khi parse
const previewImport = async (deckId, ownerId, rawText, options) => {
  await assertOwnedDeck(deckId, ownerId)

  const opts = {
    delimiter: options?.delimiter || IMPORT_DELIMITER.AUTO,
    hasHeader: options?.hasHeader !== false
  }
  const { rows, detectedDelimiter } = parseCsv(rawText, opts)

  let headers, dataRows
  if (opts.hasHeader && rows.length > 0) {
    headers = rows[0].map((h, i) => cleanCell(h) || `Cot ${i + 1}`)
    dataRows = rows.slice(1)
  } else {
    const colCount = rows[0]?.length || 0
    headers = Array.from({ length: colCount }, (_, i) => `Cot ${i + 1}`)
    dataRows = rows
  }

  return {
    headers,
    previewRows: dataRows.slice(0, IMPORT_LIMITS.PREVIEW_ROWS),
    delimiter: detectedDelimiter,
    totalRows: dataRows.length
  }
}

// Bước 2: import với column mapping
const importCards = async (deckId, ownerId, { rawText, columnMapping, options, dryRun }) => {
  const opts = {
    delimiter: options?.delimiter || IMPORT_DELIMITER.AUTO,
    hasHeader: options?.hasHeader !== false
  }

  const deck = await assertOwnedDeck(deckId, ownerId)
  const { rows } = parseCsv(rawText, opts)

  let dataRows = opts.hasHeader ? rows.slice(1) : rows
  if (dataRows.length > IMPORT_LIMITS.MAX_IMPORT_ROWS) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, `Tối đa ${IMPORT_LIMITS.MAX_IMPORT_ROWS} dòng mỗi lần import.`)
  }

  const distractorCols = columnMapping.distractors || []
  const cards = []
  const skipped = []

  dataRows.forEach((row, idx) => {
    const rowNum = (opts.hasHeader ? 2 : 1) + idx

    const front = cleanCell(row[columnMapping.front])
    const back = cleanCell(row[columnMapping.back])

    if (!front) return skipped.push({ row: rowNum, reason: 'front trống' })
    if (!back) return skipped.push({ row: rowNum, reason: 'back trống' })
    if (front.length > IMPORT_LIMITS.MAX_FIELD_LENGTH || back.length > IMPORT_LIMITS.MAX_FIELD_LENGTH) {
      return skipped.push({ row: rowNum, reason: `vượt quá ${IMPORT_LIMITS.MAX_FIELD_LENGTH} ký tự` })
    }

    // Distractor từ cột người dùng chọn (fix R2: strip prefix trước khi dedup)
    const colDistractors = distractorCols
      .map((i) => stripOptionPrefix(cleanCell(row[i])))
      .filter((v) => v && v.length <= IMPORT_LIMITS.MAX_DISTRACTOR_LENGTH)

    // Tách block MC trong front (back đã strip prefix qua extractMC)
    const mc = extractMC(front, back)
    const finalBack = mc.back

    const seen = new Set([normalizeAnswer(finalBack)])
    const finalDistractors = [...mc.distractors, ...colDistractors]
      .filter((v) => {
        const key = normalizeAnswer(v)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, IMPORT_LIMITS.MAX_DISTRACTORS)

    const cardType = finalDistractors.length > 0 ? FLASHCARD_TYPE.MULTIPLE_CHOICE : FLASHCARD_TYPE.BASIC

    cards.push({ front, stem: mc.stem, back: finalBack, distractors: finalDistractors, cardType })
  })

  if (dryRun) {
    return { imported: 0, skipped, preview: cards }
  }

  if (cards.length === 0) {
    return { imported: 0, skipped, preview: [] }
  }

  if ((deck.cardCount || 0) + cards.length > IMPORT_LIMITS.DECK_CARD_LIMIT) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `Bo the vuot qua gioi han ${IMPORT_LIMITS.DECK_CARD_LIMIT} the (hien co ${deck.cardCount || 0}, them ${cards.length}).`
    )
  }

  const last = await flashcardModel.findOne({ deckId }).sort({ sortOrder: -1 }).select('sortOrder').lean()
  const baseOrder = last ? last.sortOrder + 1 : 0

  const docs = cards.map((card, i) => ({
    deckId,
    front: card.front,
    stem: card.stem,
    back: card.back,
    distractors: card.distractors,
    cardType: card.cardType,
    sortOrder: baseOrder + i,
    source: FLASHCARD_SOURCE.IMPORT
  }))

  const inserted = await flashcardModel.insertMany(docs, { ordered: false })
  await syncCardCount(deckId)

  return { imported: inserted.length, skipped, preview: [] }
}

export default { list, create, update, remove, reorder, previewImport, importCards }
