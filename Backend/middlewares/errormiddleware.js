// errormiddleware middleware: reusable Express request validation and error handling.
import { isProduction } from '../config/env.js'
import { logger } from '../utils/logger.js'

export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path}`, err.message)

  if (err.status) {
    return res.status(err.status).json({ message: err.message, requestId: req.requestId })
  }

  if (err.name === 'CastError') {
    return res
      .status(400)
      .json({ message: 'Invalid ID format', reason: err.message, requestId: req.requestId })
  }

  if (err.name === 'ValidationError') {
    return res
      .status(400)
      .json({ message: 'Validation failed', reason: err.message, requestId: req.requestId })
  }

  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return res.status(409).json({ message: `${field} already exists`, requestId: req.requestId })
  }

  return res.status(500).json({
    message: 'Internal Server Error',
    reason: isProduction ? 'Unexpected server error' : err.message,
    requestId: req.requestId
  })
}
