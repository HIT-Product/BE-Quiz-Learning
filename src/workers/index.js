import { logger } from '../utils/index.js'
import emailWorker from './email.worker.js'

const initWorkers = () => {
  const workers = { emailWorker }

  logger.info(`Workers registered: ${Object.keys(workers).join(', ')}`)

  return workers
}

export { initWorkers }
