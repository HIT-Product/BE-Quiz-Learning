import { Worker } from 'bullmq'
import Redis from 'ioredis'
import nodemailer from 'nodemailer'

import { envConfig } from '../configs/index.js'
import { logger } from '../utils/index.js'

const connection = new Redis({
  host: envConfig.redis.host,
  port: envConfig.redis.port,
  username: envConfig.redis.username,
  password: envConfig.redis.password,
  maxRetriesPerRequest: null
})

const emailWorker = new Worker(
  'email',
  async (job) => {
    const { email, displayName } = job.data

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: envConfig.email.user,
        pass: envConfig.email.pass
      }
    })
    if (job.name === 'reset-password') {
      const { email, displayName, otp } = job.data
      await transporter.sendMail({
        from: envConfig.email.user,
        to: email,
        subject: 'Ma khoi phuc mat khau Quiz Learning',
        html: `
          <h2>Xin chao ${displayName}!</h2>
          <p>Ma OTP khoi phuc mat khau cua ban la:</p>
          <h1>${otp}</h1>
          <p>Ma co hieu luc trong 10 phut. Neu ban khong yeu cau, hay bo qua email nay.</p>
        `
      })
      logger.info(`Reset password OTP sent to ${email}`)
      return
    }
    await transporter.sendMail({
      from: envConfig.email.user,
      to: email,
      subject: 'Chao mung ban den voi Quiz Learning',
      html: `
                <h2>Xin chao ${displayName}!</h2>
                <p>Ban da dang ky tai khoan thanh cong.</p>
                <p>Chuc ban co trai nghiem hoc tap tuyet voi cung he thong.</p>
                <p>Tran trong,</p>
                <p>Doi ngu Quiz Learning</p>
            `
    })

    logger.info(`Email sent to ${email}`)
  },
  {
    connection
  }
)

emailWorker.on('completed', (job) => {
  logger.info(`Email job ${job.id} completed`)
})

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job.id} failed: ${err.message}`)
})

export default emailWorker
