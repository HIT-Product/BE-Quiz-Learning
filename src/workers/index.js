import { logger } from '../utils/index.js'
import emailWorker from './email.worker.js'

// Chỉ gom các worker lại và log để xác nhận đã đăng ký.
const initWorkers = () => {
  const workers = { emailWorker }

  logger.info(`Workers registered: ${Object.keys(workers).join(', ')}`)

  return workers
}

export { initWorkers }
