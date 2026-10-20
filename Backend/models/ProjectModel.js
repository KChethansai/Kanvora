// ProjectModel model: Mongoose schema definition for persisted data.
import { Schema, model } from 'mongoose'

const ProjectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name required']
    },
    // title mirrors name for backward compat with BoardsAPI
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    color: {
      type: String,
      default: 'from-blue-500 to-blue-700'
    },
    img: {
      type: String,
      default: null
    },
    imgPublicId: {
      type: String,
      default: null
    },
    //allow boards without workspace
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'workspace',
      default: null,
      index: true
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'user'
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    membershipVersion: { type: Number, enum: [0, 1], default: 0 },
    directGrants: [{
      _id: false,
      user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      role: { type: String, enum: ['MEMBER', 'VIEWER'], required: true },
      grantedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
      createdAt: { type: Date, required: true }
    }],
    isEditable: {
      type: Boolean,
      default: false
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    publishDetails: {
      companyName: { type: String, default: "" },
      website: { type: String, default: "" },
      contactEmail: { type: String, default: "" },
      templateType: { type: String, default: "" },
      category: { type: String, default: "" },
      notes: { type: String, default: "" }
    },
    isTemplate: {
      type: Boolean,
      default: false
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true
    },
    auditLogs: [
      {
        actor: { type: Schema.Types.ObjectId, ref: 'user', default: null },
        action: { type: String, required: true },
        meta: { type: Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: Boolean,
      default: true
    }
  },
  {
    versionKey: false,
    timestamps: true
  }
)

// pre-save: keep title and name in sync
ProjectSchema.pre('save', function (next) {
  if (this.title && !this.name) this.name = this.title
  if (this.name && !this.title) this.title = this.name
  next()
})

ProjectSchema.index({ workspace: 1, status: 1, archivedAt: 1, updatedAt: -1 })
ProjectSchema.index({ creatorId: 1, status: 1, updatedAt: -1 })

export const projectModel = model('project', ProjectSchema)

