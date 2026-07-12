const COOKIE_NAME = {
  REFRESH_TOKEN: 'refreshToken'
}

const COOKIE_SAME_SITE = {
  PRODUCTION: 'none',
  DEVELOPMENT: 'lax'
}

const COOKIE_PATH = {
  AUTH: '/api/v1/auth'
}

const COOKIE_MAX_AGE = {
  REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000
}

export { COOKIE_NAME, COOKIE_SAME_SITE, COOKIE_PATH, COOKIE_MAX_AGE }
