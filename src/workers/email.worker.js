import { Worker } from 'bullmq'
import Redis from 'ioredis'
import nodemailer from 'nodemailer'

import { envConfig } from '../configs/index.js'
import { AUTH_LIMITS, EMAIL_JOB_NAME, QUEUE_EVENT, QUEUE_NAME } from '../constants/index.js'
import { logger } from '../utils/index.js'

const connection = new Redis({
  host: envConfig.redis.host,
  port: envConfig.redis.port,
  username: envConfig.redis.username,
  password: envConfig.redis.password,
  maxRetriesPerRequest: null
})

const emailWorker = new Worker(
  QUEUE_NAME.EMAIL,
  async (job) => {
    const { email, displayName } = job.data

    const transporter = nodemailer.createTransport({
      host: envConfig.email.host,
      port: envConfig.email.port,
      secure: envConfig.email.secure,
      auth: {
        user: envConfig.email.user,
        pass: envConfig.email.pass
      }
    })
    if (job.name === EMAIL_JOB_NAME.RESET_PASSWORD) {
      const { email, displayName, otp } = job.data
      await transporter.sendMail({
        from: envConfig.email.user,
        to: email,
        subject: 'Ma khoi phuc mat khau Quiz Learning',
        html: `
          <h2>Xin chao ${displayName}!</h2>
          <p>Ma OTP khoi phuc mat khau cua ban la:</p>
          <h1>${otp}</h1>
          <p>Ma co hieu luc trong ${AUTH_LIMITS.FORGOT_PASSWORD_OTP_TTL_MS / 60 / 1000} phut. Neu ban khong yeu cau, hay bo qua email nay.</p>
        `
      })
      logger.info(`Reset password OTP sent to ${email}`)
      return
    }
    if (job.name === EMAIL_JOB_NAME.REGISTER_OTP) {
      const { email, displayName, otp } = job.data
      await transporter.sendMail({
        from: envConfig.email.user,
        to: email,
        subject: 'Ma xac thuc dang ky Quiz Learning',
        html: `
      <h2>Xin chao ${displayName}!</h2>
      <p>Ma OTP xac thuc dang ky cua ban la:</p>
      <h1>${otp}</h1>
      <p>Ma co hieu luc trong ${AUTH_LIMITS.REGISTER_OTP_EXPIRES_IN_SECONDS / 60} phut. Neu ban khong yeu cau, hay bo qua email nay.</p>
    `
      })
      logger.info(`Register OTP sent to ${email}`)
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

emailWorker.on(QUEUE_EVENT.COMPLETED, (job) => {
  logger.info(`Email job ${job.id} completed`)
})

emailWorker.on(QUEUE_EVENT.FAILED, (job, err) => {
  logger.error(`Email job ${job.id} failed: ${err.message}`)
})

export default emailWorker
