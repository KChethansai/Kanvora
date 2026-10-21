// origins: one source of truth for the browser origins the API accepts.
// The REST CORS allowlist and the Socket.IO handshake check must agree, or a
// deployment can pass every HTTP request and still fail every realtime one.
export const normalizeOrigin = (url) => String(url || '').trim().replace(/\/+$/, '')

// Configured client origins, normalised and de-duplicated. A trailing slash in
// CLIENT_URL is a common copy/paste error and must not silently disable
// realtime connections.
export const clientOrigins = (clientUrls = []) =>
  [...new Set(clientUrls.map(normalizeOrigin).filter(Boolean))]

export const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173']
