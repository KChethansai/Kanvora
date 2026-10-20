// Taskmodel model: Mongoose schema definition for persisted data.
import { Schema, model } from 'mongoose'

const TaskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      minlength: [1, 'title should be minimum of 1 character']
    },
    description: {
      type: String,
      default: ''
    },
    richDescription: {
      type: String,
      default: ''
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      default: null
    },
    memberIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'user'
    },
    //allow cards before project binding
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'project',
      default: null,
      index: true
    },
    //allow cards before list binding
    listId: {
      type: Schema.Types.ObjectId,
      ref: 'list',
      default: null,
      index: true
    },
    labels: [
      {
        text: String,
        color: String
      }
    ],
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    estimatedMinutes: {
      type: Number,
      min: 0,
      default: 0
    },
    recurring: {
      enabled: { type: Boolean, default: false },
      interval: {
        type: String,
        enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'],
        default: 'NONE'
      },
      nextRunAt: { type: Date, default: null }
    },
    subtasks: [
      {
        title: { type: String, required: true },
        completed: { type: Boolean, default: false },
        assigneeId: { type: Schema.Types.ObjectId, ref: 'user', default: null }
      }
    ],
    checklists: [
      {
        title: { type: String, default: 'Checklist' },
        items: [
          {
            title: { type: String, required: true },
            completed: { type: Boolean, default: false }
          }
        ]
      }
    ],
    coverImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    watchers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    comments: [
      {
        body: { type: String, required: true },
        authorId: { type: Schema.Types.ObjectId, ref: 'user' },
        mentions: [{ type: Schema.Types.ObjectId, ref: 'user' }],
        parentId: { type: Schema.Types.ObjectId, default: null },
        createdAt: { type: Date, default: Date.now },
        reactions: [
          {
            emoji: { type: String, required: true },
            userId: { type: Schema.Types.ObjectId, ref: 'user' }
          }
        ]
      }
    ],
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'user' }
      }
    ],
    order: {
      type: Number,
      default: 0,
      index: true
    },
    attachment: [
      {
        name: {
          type: String,
          required: [true, 'Attachment name is required']
        },
        url: {
          type: String,
          required: [true, 'Attachment URL is required']
        },
        publicId: {
          type: String,
          default: null
        },
        storage: {
          type: String,
          enum: ['upload', 'authenticated'],
          default: 'upload'
        },
        fileType: {
          type: String,
          enum: ['image/jpeg', 'image/png'],
          required: [true, 'Attachment image type is required']
        },
        size: {
          type: Number,
          required: [true, 'Attachment size is required']
        }
      }
    ],
    status: {
      type: String,
      enum: ['TO-DO', 'IN-PROGRESS', 'DONE'],
      default: 'TO-DO'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

TaskSchema.index({ projectId: 1, listId: 1, isActive: 1, order: 1 })
TaskSchema.index({ projectId: 1, dueDate: 1, priority: 1 })
TaskSchema.index({ watchers: 1, updatedAt: -1 })

export const taskModel = model('task', TaskSchema)


