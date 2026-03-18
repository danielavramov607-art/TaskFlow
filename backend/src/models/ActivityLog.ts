import mongoose, { Document, Schema } from "mongoose";

export interface IActivityLog extends Document {
  board: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
