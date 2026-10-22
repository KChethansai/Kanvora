// Request failure classification.
//
// The client used to report every failure the same way, so an expired
// session, a revoked permission, a rate limit and a lost connection were
// indistinguishable. The interface can only say something useful when it
// knows which of them happened.

export const requestErrorKind = (error) => {
  const status = error?.response?.status
  if (typeof status !== 'number') return 'network'
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notFound'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rateLimited'
  if (status >= 500) return 'server'
  return 'unknown'
}

const MESSAGES = {
  unauthenticated: 'Your session has expired. Sign in again to continue.',
  forbidden: 'You do not have permission to do that.',
  notFound: 'That item is no longer available.',
  conflict: 'Someone else changed this first. Reload to see the current state.',
  rateLimited: 'Too many requests. Wait a moment and try again.',
  server: 'The server could not complete the request. Try again in a moment.',
  network: 'The server could not be reached. Check your connection and try again.',
  unknown: 'The request could not be completed.'
}

export const requestErrorMessage = (kind, fallback) => MESSAGES[kind] || fallback || MESSAGES.unknown
