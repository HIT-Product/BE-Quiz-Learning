import Joi from 'joi'

import { IMPORT_DELIMITER, IMPORT_DELIMITERS, IMPORT_LIMITS } from '../../constants/index.js'

const create = {
  body: Joi.object({
    front: Joi.string().trim().required(),
    back: Joi.string().trim().required(),
    sortOrder: Joi.number().integer().min(0),
    distractors: Joi.array().items(Joi.string().trim()).default([])
  })
}

const update = {
  body: Joi.object({
    front: Joi.string().trim(),
    back: Joi.string().trim(),
    sortOrder: Joi.number().integer().min(0),
    distractors: Joi.array().items(Joi.string().trim()).default([])
  }).min(1)
}

const reorder = {
  body: Joi.object({
    orderedIds: Joi.array().items(Joi.string()).min(1).required()
  })
}

const previewImport = {
  body: Joi.object({
    rawText: Joi.string().min(1).max(IMPORT_LIMITS.RAW_TEXT_MAX_LENGTH).required(),
    options: Joi.object({
      delimiter: Joi.string()
        .valid(...IMPORT_DELIMITERS)
        .default(IMPORT_DELIMITER.AUTO),
      hasHeader: Joi.boolean().default(true)
    }).default({})
  })
}

const importCards = {
  body: Joi.object({
    rawText: Joi.string().min(1).max(IMPORT_LIMITS.RAW_TEXT_MAX_LENGTH).required(),
    columnMapping: Joi.object({
      front: Joi.number().integer().min(0).required(),
      back: Joi.number().integer().min(0).required(),
      distractors: Joi.array().items(Joi.number().integer().min(0)).max(IMPORT_LIMITS.MAX_DISTRACTORS).default([])
    }).required(),
    options: Joi.object({
      delimiter: Joi.string()
        .valid(...IMPORT_DELIMITERS)
        .default(IMPORT_DELIMITER.AUTO),
      hasHeader: Joi.boolean().default(true)
    }).default({}),
    dryRun: Joi.boolean().default(false)
  })
}

export default { create, update, reorder, previewImport, importCards }
