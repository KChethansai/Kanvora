// Signed keyset cursors: one pagination scheme for every paged read.
//
// A cursor carries the sort key of the last row of a page. The scope binds it
// to the caller, the endpoint and the resource it was issued for, and the
// signature makes it unforgeable, so a cursor cannot be replayed against
// another board, another list or another account.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

const CURSOR_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/

const signature = (value) => createHmac('sha256', env.secretKey).update(value).digest('base64url')

const badRequest = (message) => {
  const error = new Error(message)
  error.status = 400
  throw error
}

// The page size a caller may ask for. The server never returns more than this
// in one response, so an oversized board cannot be read in one round trip.
export const MAX_PAGE_SIZE = 100

// Parse a caller supplied page size. The value must be a positive integer no
// larger than the maximum; anything else is rejected instead of clamped.
export const parsePageLimit = (requested, maximum = MAX_PAGE_SIZE, message = 'Invalid limit') => {
  if (requested === undefined) return maximum
  if (typeof requested !== 'string' || !/^[1-9]\d{0,2}$/.test(requested) || Number(requested) > maximum) {
    badRequest(message)
  }
  return Number(requested)
}

export const encodeKeysetCursor = (scope, keys) => {
  const value = Buffer.from(JSON.stringify({ ...scope, keys })).toString('base64url')
  return `${value}.${signature(value)}`
}

export const decodeKeysetCursor = (cursor, scope, { validate = () => true, message = 'Invalid cursor' } = {}) => {
  if (typeof cursor !== 'string' || cursor.length > 1024 || !CURSOR_PATTERN.test(cursor)) badRequest(message)
  const [value, provided] = cursor.split('.')
  const expected = signature(value)
  if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    badRequest(message)
  }
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    badRequest(message)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) badRequest(message)
  const scopeKeys = Object.keys(scope)
  if (Object.keys(parsed).some((key) => !scopeKeys.includes(key) && key !== 'keys')) badRequest(message)
  if (scopeKeys.some((key) => parsed[key] !== scope[key])) badRequest(message)
  if (!Array.isArray(parsed.keys) || !validate(parsed.keys)) badRequest(message)
  return parsed.keys
}

// The rows that come after a position, for a fixed sort specification. The
// fields are compared in order, so the page resumes exactly where the previous
// page stopped and no row is skipped or repeated.
export const keysetAfter = (fields, values, direction = 'asc') => {
  const operator = direction === 'desc' ? '$lt' : '$gt'
  const clauses = []
  for (let index = 0; index < fields.length; index += 1) {
    const equal = Object.fromEntries(fields.slice(0, index).map((field, position) => [field, values[position]]))
    clauses.push({ ...equal, [fields[index]]: { [operator]: values[index] } })
  }
  return { $or: clauses }
}
