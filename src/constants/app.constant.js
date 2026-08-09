const APP_PATH = {
  PUBLIC_DIR: 'public',
  API_V1: '/api/v1',
  API_DOCS: '/api-docs',
  HEALTH_LIVE: '/health/live',
  HEALTH_READY: '/health/ready',
  ROOT: '/',
  VIEWS_DIR: 'views'
}

const APP_VIEW = {
  ENGINE_KEY: 'view engine',
  ENGINE: 'pug',
  VIEWS_KEY: 'views'
}

const APP_LIMITS = {
  BODY_SIZE: '2mb',
  SHUTDOWN_TIMEOUT_MS: 10_000
}

const APP_TRUST_PROXY = true

export { APP_PATH, APP_VIEW, APP_LIMITS, APP_TRUST_PROXY }
