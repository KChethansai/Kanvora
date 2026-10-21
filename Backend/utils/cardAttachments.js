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
// components, no control characters and a bounded length. A name that is only
// dots is a directory reference, not a file name, so it is replaced.
export const safeFileName = (value) => {
  const base = String(value ?? '').split(/[\\/]/).pop() || ''
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  if (!cleaned || /^\.+$/.test(cleaned)) return 'attachment'
  return cleaned
}
