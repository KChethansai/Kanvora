import 'dotenv/config'
import dns from 'dns'
import mongoose from 'mongoose'
import { createServer } from 'http'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createApp } from './app.js'
import { init as initSocket } from './socket.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

export { createApp }

const start = async () => {
  dns.setDefaultResultOrder('ipv4first')
  const httpServer = createServer(createApp())
  initSocket(httpServer)

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server')
    httpServer.close(() => mongoose.connection.close(false))
  })

  try {
    await mongoose.connect(env.dbUrl, { family: 4 })
    logger.info('MongoDB connected')
    httpServer.listen(env.port, () => {
      logger.info(`Server listening on port ${env.port}`)
    })
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(
          `Port ${env.port} is in use. Is another instance already running?`
        )
        process.exit(1)
      } else {
        throw err
      }
    })
  } catch (err) {
    logger.error('MongoDB connection failed:', err.message)
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start()
}
