const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')

// Bỏ tiền tố lựa chọn dạng "A. ", "1) ", "b - "... ở đầu chuỗi
const OPTION_PREFIX = /^\s*(?:[A-Za-z]|\d{1,2})\s*[.)\:-]\s+/
const stripOptionPrefix = (text) =>
  String(text ?? '')
    .replace(OPTION_PREFIX, '')
    .trim()

// So khớp đáp án "lỏng": bỏ prefix và normalize cả hai vế
const matchAnswer = (a, b) => normalize(stripOptionPrefix(a)) === normalize(stripOptionPrefix(b))

// Bỏ dấu tiếng Việt
const stripAccents = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')

// Khoảng cách Levenshtein
const levenshtein = (a, b) => {
  a = String(a ?? '')
  b = String(b ?? '')
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

// Chấm "gần đúng" với 3 mức:
//   strict   - luôn false (chỉ dùng matchAnswer)
//   moderate - Levenshtein <= 15% độ dài, giữ dấu
//   loose    - bỏ dấu tiếng Việt + Levenshtein <= 25% độ dài
const isCloseAnswer = (input, answer, { mode = 'moderate', maxLen = 64 } = {}) => {
  if (mode === 'strict') return false

  let a = normalize(stripOptionPrefix(input))
  let b = normalize(stripOptionPrefix(answer))

  if (mode === 'loose') {
    a = stripAccents(a)
    b = stripAccents(b)
  }

  if (!a || !b) return false
  if (a === b) return true
  if (a.length > maxLen || b.length > maxLen) return false

  const ratio = mode === 'loose' ? 0.25 : 0.15
  const maxEdits = b.length <= 6 ? 1 : Math.ceil(b.length * ratio)
  return levenshtein(a, b) <= maxEdits
}

export { shuffle, normalize, stripOptionPrefix, matchAnswer, stripAccents, levenshtein, isCloseAnswer }
