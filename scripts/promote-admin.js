import mongoose from 'mongoose'

import envConfig from '../src/configs/env.config.js'
import { USER_ROLE } from '../src/constants/index.js'
import userModel from '../src/models/user.model.js'

const email = process.argv[2]?.trim().toLowerCase()

if (!email || !email.includes('@')) {
  console.error('Usage: npm run admin:promote -- admin@example.com')
  process.exit(1)
}

try {
  await mongoose.connect(envConfig.mongo.uri)

  const user = await userModel
    .findOneAndUpdate({ email }, { $set: { role: USER_ROLE.ADMIN } }, { new: true })
    .select('email role')
    .lean()

  if (!user) {
    console.error(`User not found: ${email}`)
    process.exitCode = 1
  } else {
    console.log(`Promoted ${user.email} to ${user.role}.`)
  }
} catch (error) {
  console.error(`Failed to promote admin: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
