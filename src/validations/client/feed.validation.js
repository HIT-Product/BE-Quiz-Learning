import Joi from 'joi'

import { SOCIAL_LIMITS } from '../../constants/index.js'

const pagination = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(SOCIAL_LIMITS.PAGE_DEFAULT),
    limit: Joi.number().integer().min(1).max(SOCIAL_LIMITS.PAGE_LIMIT_MAX).default(SOCIAL_LIMITS.PAGE_LIMIT_DEFAULT)
  })
}

export default { pagination }
