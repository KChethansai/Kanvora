//upload image buffer to Cloudinary
import cloudinary from './cloudinary.js'

export const uploadToCloudinary = (buffer, folder = 'blog_users', { privateAsset = false } = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', type: privateAsset ? 'authenticated' : 'upload' },
      (err, result) => {
        if (err) return reject(err)
        resolve(result)
      }
    )

    stream.end(buffer)
  })
}
