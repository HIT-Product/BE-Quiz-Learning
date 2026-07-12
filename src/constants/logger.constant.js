const HTTP_STATUS_FALLBACK = 200

const HTTP_STATUS_LEVEL = {
  WARN: 400,
  ERROR: 500
}

const MORGAN_TOKEN = {
  BODY: 'body',
  PARAMS: 'params'
}

const MORGAN_FORMAT = '[:method] [:status] :url :response-time ms - Params: :params - Body: :body'
const MORGAN_STATUS_PATTERN = /(?<= \[)\d+(?=\])/g

export { HTTP_STATUS_FALLBACK, HTTP_STATUS_LEVEL, MORGAN_TOKEN, MORGAN_FORMAT, MORGAN_STATUS_PATTERN }
