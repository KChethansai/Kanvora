// Socket identities and room admission are always derived from current server data.
import { Server } from 'socket.io'
import { env } from './config/env.js'
import { allowedClientOrigins, normalizeOrigin } from './config/origins.js'
import { verifySession } from './config/session.js'
import { UserModel } from './models/usermodel.js'
import { findProject, findTask } from './authorization/resources.js'

let io = null
const roomPresence = new Map()
const userAdmissions = new Map()
const MAX_USER_SOCKETS = 8
const MAX_PENDING_HANDSHAKES = 4
const MAX_HANDSHAKES_PER_SECOND = 20
const MAX_TYPING_PER_SOCKET = 20
const MAX_TYPING_PER_USER = 40
const MAX_TYPING_IN_FLIGHT = 4
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

const releaseUserAdmission = (userId, admission) => {
  if (admission.sockets || admission.pending || admission.join.inFlight || admission.typing.inFlight) return
  if (userAdmissions.get(userId) !== admission) return
  const remaining = Math.max(admission.handshake.window, admission.join.window, admission.typing.window) + 1000 - Date.now()
  if (remaining <= 0) {
    userAdmissions.delete(userId)
  } else if (!admission.cleanupTimer) {
    admission.cleanupTimer = setTimeout(() => {
      admission.cleanupTimer = null
      releaseUserAdmission(userId, admission)
    }, remaining)
    admission.cleanupTimer.unref()
  }
}

// Leaving a board room invalidates the admission that put the socket there.
const leaveProjectRoom = (socket, projectId) => {
  socket.data.accessVersion++
  leaveRoom(socket, `project:${projectId}`)
}

// Evict the sockets of one member from a board. The member keeps the rest of
// the account, so only the board room is dropped.
export const revokeProjectAccess = (projectId, userId) => {
  if (!validId(projectId) || !validId(userId) || !io) return
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.user?._id !== userId) continue
    leaveProjectRoom(socket, projectId)
  }
}

// Evict every socket that joined a board. A board that can no longer be read
// must not keep a live room: the sockets would keep receiving traffic for a
// board their owner may not read any more.
export const revokeProjectRoom = (projectId) => {
  if (!validId(projectId) || !io) return
  const room = `project:${projectId}`
  for (const socket of io.sockets.sockets.values()) {
    if (!socket.rooms.has(room)) continue
    leaveProjectRoom(socket, projectId)
  }
}

export const revokeUserAccess = (userId) => {
  if (validId(userId)) io?.in(`user:${userId}`).disconnectSockets(true)
}

export const init = (httpServer) => {
  roomPresence.clear()
  for (const admission of userAdmissions.values()) clearTimeout(admission.cleanupTimer)
  userAdmissions.clear()
  const origins = new Set(allowedClientOrigins(env))
  io = new Server(httpServer, {
    transports: ['websocket'],
    maxHttpBufferSize: 16384,
    cors: { origin: [...origins], methods: ['GET', 'POST'], credentials: true },
    allowRequest: (request, done) => done(null, origins.has(normalizeOrigin(request.headers.origin)))
  })

  const userAdmission = (userId) => {
    const admission = userAdmissions.get(userId) || {
      sockets: 0, pending: 0,
      handshake: { window: 0, count: 0 },
      join: { window: 0, count: 0, inFlight: 0 },
      typing: { window: 0, count: 0, inFlight: 0 },
      cleanupTimer: null
    }
    clearTimeout(admission.cleanupTimer)
    admission.cleanupTimer = null
    userAdmissions.set(userId, admission)
    return admission
  }

  io.use(async (socket, next) => {
    let userId = null
    let admission = null
    let reserved = false
    let connected = false
    try {
      const cookie = socket.handshake.headers.cookie || ''
      const token = socket.handshake.auth?.token || cookie.split(';')
        .map((item) => item.trim()).find((item) => item.startsWith('token='))?.slice(6)
      const claims = verifySession(token)
      userId = String(claims.id)
      if (!validId(userId)) throw new Error()
      admission = userAdmission(userId)
      const now = Date.now()
      if (now - admission.handshake.window >= 1000) {
        admission.handshake.window = now
        admission.handshake.count = 0
      }
      // Capacity is reserved before any database work so parallel handshakes
      // cannot multiply authorization queries. Rejected and failed attempts
      // release their reservation.
      if (admission.sockets >= MAX_USER_SOCKETS) throw new Error()
      if (admission.pending >= MAX_PENDING_HANDSHAKES) throw new Error()
      if (admission.handshake.count >= MAX_HANDSHAKES_PER_SECOND) throw new Error()
      admission.sockets++
      admission.pending++
      admission.handshake.count++
      reserved = true
      const user = await UserModel.findById(claims.id).select('_id name profilePic sessionVersion').lean()
      if (!user || (user.sessionVersion ?? 0) !== claims.ver) throw new Error()
      socket.data.user = publicUser(user)
      socket.data.expiresAt = claims.exp * 1000
      socket.data.sessionVersion = claims.ver
      socket.data.accessVersion = 0
      admission.pending--
      connected = true
      next()
    } catch {
      if (reserved && !connected) {
        admission.sockets--
        admission.pending--
        releaseUserAdmission(userId, admission)
      }
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.user._id
    const userAdmissionEntry = userAdmission(userId)
    const socketAdmission = { count: 0, window: 0, inFlight: 0 }
    socket.join(`user:${userId}`)
    // Close the handshake/revocation race: a socket that joined just before a
    // session-version bump must not stay subscribed to personal notifications.
    UserModel.findById(userId).select('sessionVersion').lean().then((current) => {
      if (!current || (current.sessionVersion ?? 0) !== socket.data.sessionVersion) {
        socket.disconnect(true)
      }
    }).catch(() => socket.disconnect(true))
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
      const current = await UserModel.findById(userId).select('sessionVersion').lean()
      if (!current || (current.sessionVersion ?? 0) !== socket.data.sessionVersion) {
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
      for (const budget of [socketAdmission, userAdmissionEntry.join]) {
        if (now - budget.window >= 1000) {
          budget.window = now
          budget.count = 0
        }
      }
      if (socketAdmission.count >= 20 || userAdmissionEntry.join.count >= 40) return false
      socketAdmission.count++
      userAdmissionEntry.join.count++
      if (socketAdmission.inFlight >= 2 || userAdmissionEntry.join.inFlight >= 4) return false
      const room = `project:${projectId}`
      const atRoomLimit = () => !socket.rooms.has(room) &&
        Array.from(socket.rooms).filter((joined) => joined.startsWith('project:')).length >= 16
      if (atRoomLimit()) return false
      socketAdmission.inFlight++
      userAdmissionEntry.join.inFlight++
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
        userAdmissionEntry.join.inFlight--
        releaseUserAdmission(userId, userAdmissionEntry)
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
      if (!payload || typeof payload !== 'object') return false
      const projectId = payload.projectId || (typeof payload.room === 'string' &&
        /^project:[a-f\d]{24}$/i.test(payload.room) ? payload.room.slice(8) : null)
      if (!validId(projectId) || !validId(payload.cardId)) return false
      const now = Date.now()
      if (now - typingWindow >= 1000) {
        typingWindow = now
        typingCount = 0
      }
      if (++typingCount > MAX_TYPING_PER_SOCKET) return false
      const budget = userAdmissionEntry.typing
      if (now - budget.window >= 1000) {
        budget.window = now
        budget.count = 0
      }
      if (++budget.count > MAX_TYPING_PER_USER) return false
      if (budget.inFlight >= MAX_TYPING_IN_FLIGHT) return false
      const room = `project:${projectId}`
      budget.inFlight++
      try {
        if (!await authorized(projectId) || !socket.rooms.has(room)) return false
        const version = socket.data.accessVersion
        const task = await findTask(payload.cardId, userId, 'read')
        if (!task || String(task.projectId) !== projectId || !socket.connected ||
            version !== socket.data.accessVersion || !socket.rooms.has(room)) return false
        socket.to(room).emit(event, { room, cardId: payload.cardId, user: socket.data.user })
        return true
      } finally {
        budget.inFlight--
        releaseUserAdmission(userId, userAdmissionEntry)
      }
    }
    handle('typing-start', typing('typing-started'))
    handle('typing-stop', typing('typing-stopped'))
    // Activity is emitted only by the persistence layer, never by a client event.
    handle('activity-created', () => false)
    socket.on('disconnect', () => {
      clearTimeout(expiryTimer)
      userAdmissionEntry.sockets--
      releaseUserAdmission(userId, userAdmissionEntry)
      for (const [room, users] of roomPresence) if (users.has(socket.id)) leaveRoom(socket, room)
    })
  })
  return io
}

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialised - call init() first')
  return io
}
