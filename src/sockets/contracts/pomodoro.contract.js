import { POMODORO_PHASE, POMODORO_STATUS } from '../../constants/index.js'

const nullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const serializePomodoroState = (state = {}, serverNow = Date.now()) => {
  const status = Object.values(POMODORO_STATUS).includes(state.status) ? state.status : POMODORO_STATUS.IDLE
  const cycle = Math.max(0, nullableNumber(state.cycle) ?? 0)

  if (status === POMODORO_STATUS.IDLE) {
    return {
      status,
      phase: null,
      startedAt: null,
      durationSec: null,
      remainingSec: null,
      cycle,
      serverNow
    }
  }

  const phase = Object.values(POMODORO_PHASE).includes(state.phase) ? state.phase : null
  const durationSec = nullableNumber(state.durationSec)
  const startedAt = status === POMODORO_STATUS.RUNNING ? nullableNumber(state.startedAt) : null
  const remainingSec =
    status === POMODORO_STATUS.RUNNING && startedAt !== null && durationSec !== null
      ? Math.max(0, Math.ceil((startedAt + durationSec * 1000 - serverNow) / 1000))
      : Math.max(0, nullableNumber(state.remainingSec) ?? durationSec ?? 0)

  return {
    status,
    phase,
    startedAt,
    durationSec,
    remainingSec,
    cycle,
    serverNow
  }
}

export { serializePomodoroState }
