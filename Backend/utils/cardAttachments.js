// Card attachments: an atomic append and a plain stored file name.
import { taskModel } from '../models/Taskmodel.js'

// The attachment is appended to the card with a single atomic update. A
// read-modify-write of the whole card document would drop one attachment when
// two uploads land at the same time.
export const appendAttachment = async ({ cardId, attachment }) =>
  taskModel.findOneAndUpdate(
    { _id: cardId, isActive: true },
    { $push: { attachment } },
    { new: true, runValidators: true }
  )

// The client supplied file name is stored as a plain name: no directory
// components, no control characters and a bounded length.
export const safeFileName = (value) => {
  const base = String(value ?? '').split(/[\\/]/).pop() || ''
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255) || 'attachment'
}
