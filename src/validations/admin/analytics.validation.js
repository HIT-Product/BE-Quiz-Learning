import Joi from 'joi'

const overview = {
  query: Joi.object({
    days: Joi.number().integer().valid(7, 30, 90).default(30)
  })
}

export default { overview }
