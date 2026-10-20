const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const jpegStart = [0xff, 0xd8, 0xff]

const startsWith = (buffer, signature) => signature.every((byte, index) => buffer[index] === byte)

export const hasImageSignature = (buffer, mimetype) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false
  if (mimetype === 'image/png') return startsWith(buffer, png)
  if (mimetype === 'image/jpeg') return startsWith(buffer, jpegStart)
  return false
}
