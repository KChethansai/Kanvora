// Invitation model: Mongoose schema definition for persisted data.
import { Schema, model } from "mongoose";

const invitationSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    workspace: {
      type: Schema.Types.ObjectId,
      ref: "workspace",
      required: true,
    },

    role: {
      type: String,
      enum: ["Admin", "Manager", "Member", "Viewer"],
      default: "Member",
    },

    token: {
      type: String,
      required: true,
      unique: true,
    },

    tokenHash: { type: String, unique: true, sparse: true },
    invitationVersion: { type: Number, default: 0 },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
invitationSchema.index({ workspace: 1, email: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model("Invitation", invitationSchema);

