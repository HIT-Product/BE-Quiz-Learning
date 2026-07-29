import { StatusCodes } from 'http-status-codes'

import { response } from '../utils/index.js'

const validate = (schema) => (req, res, next) => {
  for (const key in schema) {
    const { value, error } = schema[key].validate(req[key], {
      abortEarly: false,
      stripUnknown: true
    })

    if (error) {
      const messages = error.details.map((detail) => detail.message).join(',')
      return res.status(StatusCodes.BAD_REQUEST).json(response(StatusCodes.BAD_REQUEST, messages))
    }

    if (key === 'query') {
      req.validatedQuery = value
    } else {
      req[key] = value
    }
  }

  next()
}

export default validate
