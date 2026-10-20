// NotificationsAPI routes: Express endpoints for this backend resource.
import express from 'express'
import {
  getNotifications,
  markOneRead,
  markAllRead,
  deleteNotification,
  sendInvite,
  acceptInvite,
  rejectInvite
} from '../controllers/notificationController.js'
import { verifyRolesToken } from '../middlewares/verifyRolesToken.js'

export const notificationApp = express.Router()

const auth = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')

// get all notifications for current user (paginated)
notificationApp.get('/', auth, getNotifications)

// mark all as read — must be before /:id
notificationApp.put('/read-all', auth, markAllRead)

// send a project invite
notificationApp.post('/invite', auth, sendInvite)

// mark one as read
notificationApp.put('/:id/read', auth, markOneRead)

// accept a pending invite
notificationApp.post('/:id/accept', auth, acceptInvite)

// reject a pending invite
notificationApp.post('/:id/reject', auth, rejectInvite)

// delete one
notificationApp.delete('/:id', auth, deleteNotification)
