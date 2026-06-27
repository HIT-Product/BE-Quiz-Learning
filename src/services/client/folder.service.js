import { StatusCodes } from 'http-status-codes'

import { folderModel, deckModel } from '../../models/index.js'
import { ApiError } from '../../utils/index.js'

// Tim folder so huu
const findOwnedFolder = async (folderId, ownerId) => {
  const folder = await folderModel.findOne({ _id: folderId, ownerId })
  if (!folder) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy thư mục.')
  }
  return folder
}

// Lay danh sach folder
const list = async (ownerId) => {
  return folderModel.find({ ownerId }).sort({ createdAt: -1 })
}

// Lay chi tiet folder
const getById = async (folderId, ownerId) => {
  return findOwnedFolder(folderId, ownerId)
}

// Tao folder
const create = async (ownerId, { name }) => {
  return folderModel.create({ ownerId, name })
}

// Cap nhat folder
const update = async (folderId, ownerId, { name }) => {
  const folder = await findOwnedFolder(folderId, ownerId)
  folder.name = name
  await folder.save()
  return folder
}

// Xoa folder
const remove = async (folderId, ownerId) => {
  const folder = await findOwnedFolder(folderId, ownerId)

  await deckModel.updateMany({ folderId: folder._id, ownerId }, { folderId: null })

  await folder.deleteOne()
}

export default {
  list,
  getById,
  create,
  update,
  remove
}
