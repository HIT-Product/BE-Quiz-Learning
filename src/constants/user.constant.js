const USER_LIMITS = {
  DISPLAY_NAME_MAX_LENGTH: 120,
  DEFAULT_QUIZ_SIZE: 10,
  QUIZ_SIZE_MIN: 1,
  QUIZ_SIZE_MAX: 100,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30
}

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$/
const USERNAME_RESERVED = Object.freeze(['admin', 'support', 'hitproduct', 'me', 'system'])

export { USER_LIMITS, USERNAME_PATTERN, USERNAME_RESERVED }