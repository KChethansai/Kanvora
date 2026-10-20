// Workspace model: Mongoose schema definition for persisted data.
import { Schema, model } from "mongoose";
const workspaceSchema = new Schema( //creation of workspace schema
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    status: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "user",
        },
        role: {
          type: String,
          enum: ["MANAGER", "MEMBER", "VIEWER", "ADMIN"],
          default: "MEMBER",
        },
      },
    ],
    permissions: {
      ADMIN: {
        manageWorkspace: { type: Boolean, default: true },
        manageMembers: { type: Boolean, default: true },
        manageBoards: { type: Boolean, default: true },
      },
      MANAGER: {
        manageWorkspace: { type: Boolean, default: false },
        manageMembers: { type: Boolean, default: true },
        manageBoards: { type: Boolean, default: true },
      },
      MEMBER: {
        manageWorkspace: { type: Boolean, default: false },
        manageMembers: { type: Boolean, default: false },
        manageBoards: { type: Boolean, default: true },
      },
      VIEWER: {
        manageWorkspace: { type: Boolean, default: false },
        manageMembers: { type: Boolean, default: false },
        manageBoards: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);
workspaceSchema.index({ owner: 1, updatedAt: -1 });
workspaceSchema.index({ "members.user": 1, updatedAt: -1 });
export const WorkspaceModel = model("workspace", workspaceSchema);

