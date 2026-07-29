import { ApiError, logger } from '../../utils/index.js'

const socketError = (code, message) => Object.assign(new Error(message), { code, isSocketError: true })

const safeHandler = (handler) => async (payload, ack) => {
  try {
    const result = await handler(payload ?? {})
    if (typeof ack === 'function') ack({ ok: true, data: result ?? null })
  } catch (error) {
    const isExpected = error instanceof ApiError || error.isSocketError
    logger[isExpected ? 'warn' : 'error'](`Socket handler failed: ${error.message}`)

    if (typeof ack === 'function') {
      ack({
        ok: false,
        code: error.code || 'INTERNAL_ERROR',
        message: isExpected ? error.message : 'Co loi xay ra, vui long thu lai.'
      })
    }
  }
}

export { safeHandler, socketError }
