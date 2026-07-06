const QUEUE_NAME = {
  EMAIL: 'email'
}

const EMAIL_JOB_NAME = {
  RESET_PASSWORD: 'reset-password',
  REGISTER_OTP: 'register-otp',
  WELCOME: 'welcome'
}

const QUEUE_EVENT = {
  COMPLETED: 'completed',
  FAILED: 'failed'
}

const QUEUE_BACKOFF_TYPE = {
  EXPONENTIAL: 'exponential'
}

const EMAIL_QUEUE_OPTIONS = {
  ATTEMPTS: 3,
  BACKOFF_DELAY: 1000,
  REMOVE_ON_COMPLETE: true
}

export { QUEUE_NAME, EMAIL_JOB_NAME, QUEUE_EVENT, QUEUE_BACKOFF_TYPE, EMAIL_QUEUE_OPTIONS }
