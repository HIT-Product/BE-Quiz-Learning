import mongoose, { model } from 'mongoose'

const folderSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 }
  },
  { timestamps: true }
)

export default model('Folder', folderSchema)
