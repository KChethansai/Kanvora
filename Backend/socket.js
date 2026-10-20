// Socket identities and room admission are always derived from current server data.
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from './config/env.js'
import { UserModel } from './models/usermodel.js'
import { findProject, findTask } from './authorization/resources.js'

let io = null
const roomPresence = new Map()
const userAdmissions = new Map()
const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const publicUser = (user) => ({
  _id: String(user._id), name: user.name, profilePic: user.profilePic || ''
})
const publishPresence = (room) => io.to(room).emit('presence-updated', {
  room, users: Array.from(roomPresence.get(room)?.values() || [])
})
const leaveRoom = (socket, room) => {
  socket.leave(room)
  const users = roomPresence.get(room)
  if (!users?.delete(socket.id)) return
  if (!users.size) roomPresence.delete(room)
  publishPresence(room)
}

export const revokeProjectAccess = (projectId, userId) => {
  if (!validId(projectId) || !validId(userId) || !io) return
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.user?._id !== userId) continue
    socket.data.accessVersion++
    leaveRoom(socket, `project:${projectId}`)
  }
}

export const revokeUserAccess = (userId) => {
  if (validId(userId)) io?.in(`user:${userId}`).disconnectSockets(true)
}

export const init = (httpServer) => {
  roomPresence.clear()
  for (const admission of userAdmissions.values()) clearTimeout(admission.cleanupTimer)
  userAdmissions.clear()
  const origins = new Set(env.clientUrls)
  if (env.nodeEnv === 'development') {
    origins.add('http://localhost:5173')
    origins.add('http://localhost:3000')
  }
  io = new Server(httpServer, {
    transports: ['websocket'],
    maxHttpBufferSize: 16384,
    cors: { origin: [...origins], methods: ['GET', 'POST'], credentials: true },
    allowRequest: (request, done) => done(null, origins.has(request.headers.origin))
  })

  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || ''
      const token = socket.handshake.auth?.token || cookie.split(';')
        .map((item) => item.trim()).find((item) => item.startsWith('token='))?.slice(6)
      if (typeof token !== 'string' || token.length > 8192) throw new Error()
      const claims = jwt.verify(token, env.secretKey, { algorithms: ['HS256'] })
      if (!validId(claims.id)) throw new Error()
      const user = await UserModel.findById(claims.id).select('_id name profilePic').lean()
      if (!user || (claims.exp && claims.exp * 1000 <= Date.now())) throw new Error()
      socket.data.user = publicUser(user)
      socket.data.expiresAt = claims.exp ? claims.exp * 1000 : null
      socket.data.accessVersion = 0
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.user._id
    const userAdmission = userAdmissions.get(userId) || { sockets: 0, count: 0, window: 0, inFlight: 0 }
    clearTimeout(userAdmission.cleanupTimer)
    userAdmission.cleanupTimer = null
    userAdmission.sockets++
    userAdmissions.set(userId, userAdmission)
    const socketAdmission = { count: 0, window: 0, inFlight: 0 }
    const releaseAdmission = () => {
      if (!userAdmission.sockets && !userAdmission.inFlight && userAdmissions.get(userId) === userAdmission) {
        const remaining = userAdmission.window + 1000 - Date.now()
        if (remaining <= 0) {
          userAdmissions.delete(userId)
        } else if (!userAdmission.cleanupTimer) {
          userAdmission.cleanupTimer = setTimeout(() => {
            userAdmission.cleanupTimer = null
            releaseAdmission()
          }, remaining)
          userAdmission.cleanupTimer.unref()
        }
      }
    }
    socket.join(`user:${userId}`)
    let expiryTimer
    const checkExpiry = () => {
      const remaining = socket.data.expiresAt - Date.now()
      if (remaining <= 0) return socket.disconnect(true)
      expiryTimer = setTimeout(checkExpiry, Math.min(remaining, 2147483647))
      expiryTimer.unref()
    }
    if (socket.data.expiresAt) checkExpiry()

    const authorized = async (projectId) => {
      if (!validId(projectId)) return false
      const version = socket.data.accessVersion
      if (socket.data.expiresAt && socket.data.expiresAt <= Date.now()) {
        socket.disconnect(true)
        return false
      }
      const user = await UserModel.exists({ _id: userId })
      if (!user) {
        socket.disconnect(true)
        return false
      }
      const project = await findProject(projectId, userId, 'read')
      if (!project || !socket.connected || version !== socket.data.accessVersion) {
        leaveRoom(socket, `project:${projectId}`)
        return false
      }
      return true
    }
    const handle = (event, handler) => socket.on(event, async (...args) => {
      const ack = typeof args.at(-1) === 'function' ? args.pop() : () => {}
      try {
        ack({ ok: Boolean(await handler(...args)) })
      } catch {
        // Authorization failures and database errors share a non-disclosing response.
        for (const room of socket.rooms) if (room.startsWith('project:')) leaveRoom(socket, room)
        ack({ ok: false })
      }
    })

    handle('join-user', (id) => validId(id) && id === userId)
    handle('join-project', async (projectId) => {
      if (!validId(projectId)) return false
      const now = Date.now()
      for (const budget of [socketAdmission, userAdmission]) {
        if (now - budget.window >= 1000) {
          budget.window = now
          budget.count = 0
        }
      }
      if (socketAdmission.count >= 20 || userAdmission.count >= 40) return false
      socketAdmission.count++
      userAdmission.count++
      if (socketAdmission.inFlight >= 2 || userAdmission.inFlight >= 4) return false
      const room = `project:${projectId}`
      const atRoomLimit = () => !socket.rooms.has(room) &&
        Array.from(socket.rooms).filter((joined) => joined.startsWith('project:')).length >= 16
      if (atRoomLimit()) return false
      socketAdmission.inFlight++
      userAdmission.inFlight++
      try {
        const version = socket.data.accessVersion
        if (!await authorized(projectId) || version !== socket.data.accessVersion || atRoomLimit()) return false
        if (socket.rooms.has(room)) return true
        socket.join(room)
        const users = roomPresence.get(room) || new Map()
        users.set(socket.id, { socketId: socket.id, ...socket.data.user })
        roomPresence.set(room, users)
        publishPresence(room)
        return true
      } finally {
        socketAdmission.inFlight--
        userAdmission.inFlight--
        releaseAdmission()
      }
    })
    handle('leave-project', (projectId) => {
      if (!validId(projectId)) return false
      socket.data.accessVersion++
      leaveRoom(socket, `project:${projectId}`)
      return true
    })

    let typingWindow = 0
    let typingCount = 0
    const typing = (event) => async (payload) => {
      if (Date.now() - typingWindow >= 1000) {
        typingWindow = Date.now()
        typingCount = 0
      }
      if (++typingCount > 20 || !payload || typeof payload !== 'object') return false
      const projectId = payload.projectId || (typeof payload.room === 'string' &&
        /^project:[a-f\d]{24}$/i.test(payload.room) ? payload.room.slice(8) : null)
      if (!validId(projectId) || !validId(payload.cardId)) return false
      const room = `project:${projectId}`
      if (!await authorized(projectId) || !socket.rooms.has(room)) return false
      const version = socket.data.accessVersion
      const task = await findTask(payload.cardId, userId, 'read')
      if (!task || String(task.projectId) !== projectId || !socket.connected ||
          version !== socket.data.accessVersion || !socket.rooms.has(room)) return false
      socket.to(room).emit(event, { room, cardId: payload.cardId, user: socket.data.user })
      return true
    }
    handle('typing-start', typing('typing-started'))
    handle('typing-stop', typing('typing-stopped'))
    // Activity is emitted only by the persistence layer, never by a client event.
    handle('activity-created', () => false)
    socket.on('disconnect', () => {
      clearTimeout(expiryTimer)
      userAdmission.sockets--
      releaseAdmission()
      for (const [room, users] of roomPresence) if (users.has(socket.id)) leaveRoom(socket, room)
    })
  })
  return io
}

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialised - call init() first')
  return io
}
