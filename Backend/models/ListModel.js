// ListModel model: Mongoose schema definition for persisted data.
import { Schema, model } from "mongoose";

const ListSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "project",
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    // Last card order allocated by the server; -1 means no card yet.
    cardSequence: {
      type: Number,
      default: -1,
      min: -1,
    },
  },
  {
    timestamps: true,
  }
);

ListSchema.index({ projectId: 1, order: 1 });

export const ListModel = model("list", ListSchema);


