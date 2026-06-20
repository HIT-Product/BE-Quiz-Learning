import { Router } from 'express'

import adminRouter from './admin/index.js'
import clientRouter from './client/index.js'

const router = Router()

router.use('/admin', adminRouter)
router.use('/', clientRouter)

export default router
