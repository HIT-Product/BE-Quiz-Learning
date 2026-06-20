import dotenv from 'dotenv'
dotenv.config()

const env = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3000
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase'
  }
}

export default env
