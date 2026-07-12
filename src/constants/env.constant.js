const NUMBER_PARSE_RADIX = 10

const ENV_DEFAULTS = {
  NODE_ENV: 'development',
  HOST: 'localhost',
  PORT: 3000,
  CLIENT_URL: 'http://localhost:5173',
  BCRYPT_SALT_ROUNDS: 10,
  REDIS_PORT: 6379,
  MONGO_URI: 'mongodb://localhost:27017/mydatabase'
}

export { NUMBER_PARSE_RADIX, ENV_DEFAULTS }
