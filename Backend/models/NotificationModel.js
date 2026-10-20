// NotificationModel model: Mongoose schema definition for persisted data.
import { Schema, model } from 'mongoose'

const NotificationSchema = new Schema(
  {
    // recipient
    user: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true
    },
    // who triggered this notification
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      default: null
    },
    // related project (for invite/activity notifications)
    project: {
      type: Schema.Types.ObjectId,
      ref: 'project',
      default: null
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['card', 'member', 'mention', 'invite', 'activity', 'default'],
      default: 'default'
    },
    // only relevant for invite notifications
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    invitationVersion: { type: Number, default: 0 },
    issuanceScope: { type: String, enum: ['workspace', 'standalone'], immutable: true },
    issuanceWorkspace: { type: Schema.Types.ObjectId, ref: 'workspace', immutable: true },
    recipientEmail: { type: String, default: '', select: false },
    grantRole: { type: String, enum: ['MEMBER', 'VIEWER'], default: 'MEMBER' },
    expiresAt: { type: Date, default: null },
    readLink: {
      type: String,
      default: ''
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

NotificationSchema.index({ user: 1, createdAt: -1 })
NotificationSchema.index({ user: 1, read: 1 })

export const NotificationModel = model('notification', NotificationSchema)
