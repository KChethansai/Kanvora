// Media provider boundary.
//
// Uploads and deletions of private Cloudinary assets go through this module so
// the failure paths can be exercised without a live provider account. The
// production defaults are the real Cloudinary calls; tests replace them with
// recording doubles and restore them afterwards.
import cloudinary from '../config/cloudinary.js'
import { uploadToCloudinary } from '../config/uploadToCloudinary.js'
import { hasImageSignature } from './image.js'
import { env } from '../config/env.js'

const providerUpload = async (file, folder, { privateAsset = false } = {}) => {
  // No file is not an error: a project update without a new background image
  // simply has nothing to upload.
  if (!file) return null
  if (!hasImageSignature(file.buffer, file.mimetype)) {
    const invalid = new Error('The uploaded file is not a valid JPEG or PNG image')
    invalid.status = 400
    throw invalid
  }
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    const err = new Error('Cloudinary image uploads are not configured')
    err.status = 503
    throw err
  }
  const uploaded = await uploadToCloudinary(file.buffer, folder, { privateAsset })
  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    fileName: file.originalname,
    fileType: file.mimetype,
    size: file.size
  }
}

const providerDestroy = (publicId, options) => cloudinary.uploader.destroy(publicId, options)

const store = { upload: providerUpload, destroy: providerDestroy }

export const setMediaStore = (replacement = {}) => {
  if (typeof replacement.upload === 'function') store.upload = replacement.upload
  if (typeof replacement.destroy === 'function') store.destroy = replacement.destroy
}

export const resetMediaStore = () => {
  store.upload = providerUpload
  store.destroy = providerDestroy
}

export const uploadImageFile = (file, folder, options) => store.upload(file, folder, options)

// Private attachments are uploaded with `type: 'authenticated'`; deletion must
// address the same delivery type or it would target a different asset.
const PRIVATE_ASSET_OPTIONS = Object.freeze({
  resource_type: 'image',
  type: 'authenticated',
  invalidate: true
})

export const deletePrivateAsset = async (publicId) => {
  if (typeof publicId !== 'string' || !publicId) return { ok: false, skipped: true }
  try {
    const result = await store.destroy(publicId, { ...PRIVATE_ASSET_OPTIONS })
    // A missing asset is already clean, so cleanup is idempotent and safe to
    // retry after a partial failure.
    return { ok: true, result: result?.result || 'ok' }
  } catch (error) {
    // The database change already committed, so this is a recoverable orphan
    // rather than a failed request. Record it without provider credentials.
    console.error(`Attachment cleanup failed for ${publicId}: ${error?.message || 'provider error'}`)
    return { ok: false }
  }
}

export const deletePrivateAssets = async (publicIds = []) => {
  const results = []
  for (const publicId of [...new Set(publicIds.filter(Boolean))]) {
    results.push(await deletePrivateAsset(publicId))
  }
  return results
}
