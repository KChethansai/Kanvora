import cloudinary from './cloudinary.js'

export const privateAttachmentUrl = (publicId, fileType) => {
  const format = fileType === 'image/png' ? 'png' : 'jpg'
  const expires = Math.floor(Date.now() / 1000) + 5 * 60
  return cloudinary.utils.private_download_url(publicId, format, {
    expires_at: expires,
    resource_type: 'image',
    type: 'authenticated'
  })
}
