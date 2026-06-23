import { initWorkers } from './workers/index.js'
import { logger } from './utils/index.js'

const { emailWorker } = initWorkers()

logger.info('Worker process started')

let isShuttingDown = false

const shutdown = async (signal) => {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info(`Received ${signal}, shutting down worker...`)

    try {
        await emailWorker.close()
        logger.info('Worker process shut down gracefully.')
        process.exit(0)
    } catch (error) {
        logger.error(`Error while shutting down worker: ${error.message}`)
        process.exit(1)
    }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))