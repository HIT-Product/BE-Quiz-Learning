import assert from 'node:assert/strict'
import test from 'node:test'

process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
process.env.CLOUDINARY_API_KEY = 'test-key'
process.env.CLOUDINARY_API_SECRET = 'test-secret'

const { default: cloudinary } = await import('../../src/configs/cloudinary.config.js')
const { default: cloudinaryService, getAvatarPublicId } = await import('../../src/services/cloudinary.service.js')
const { AVATAR_MAX_SIZE_BYTES, avatarFileFilter } = await import('../../src/middlewares/upload.middleware.js')

test('avatar upload uses a deterministic Cloudinary public ID and secure result URL', async (t) => {
  const originalUploadStream = cloudinary.uploader.upload_stream
  t.after(() => {
    cloudinary.uploader.upload_stream = originalUploadStream
  })

  const buffer = Buffer.from('fake-image')
  let receivedOptions
  let receivedBuffer

  cloudinary.uploader.upload_stream = (options, callback) => {
    receivedOptions = options
    return {
      end(value) {
        receivedBuffer = value
        callback(null, {
          public_id: options.public_id,
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/avatar.webp'
        })
      }
    }
  }

  const result = await cloudinaryService.uploadAvatar(buffer, 'user-123')

  assert.equal(receivedOptions.public_id, 'hit-product/avatars/user-123')
  assert.equal(receivedOptions.resource_type, 'image')
  assert.equal(receivedOptions.overwrite, true)
  assert.equal(receivedOptions.invalidate, true)
  assert.equal(receivedBuffer, buffer)
  assert.match(result.secure_url, /^https:\/\//)
})

test('avatar deletion invalidates the deterministic Cloudinary asset', async (t) => {
  const originalDestroy = cloudinary.uploader.destroy
  t.after(() => {
    cloudinary.uploader.destroy = originalDestroy
  })

  let receivedPublicId
  let receivedOptions
  cloudinary.uploader.destroy = async (publicId, options) => {
    receivedPublicId = publicId
    receivedOptions = options
    return { result: 'ok' }
  }

  const result = await cloudinaryService.deleteAvatar('user-123')

  assert.equal(receivedPublicId, getAvatarPublicId('user-123'))
  assert.deepEqual(receivedOptions, { resource_type: 'image', invalidate: true })
  assert.deepEqual(result, { result: 'ok' })
})

test('avatar file filter accepts safe image types and rejects SVG', () => {
  let accepted
  avatarFileFilter({}, { mimetype: 'image/png' }, (error, value) => {
    assert.equal(error, null)
    accepted = value
  })
  assert.equal(accepted, true)

  avatarFileFilter({}, { mimetype: 'image/svg+xml' }, (error) => {
    assert.equal(error.statusCode, 400)
    assert.match(error.message, /JPEG, PNG, WebP hoac GIF/)
  })

  assert.equal(AVATAR_MAX_SIZE_BYTES, 5 * 1024 * 1024)
})
