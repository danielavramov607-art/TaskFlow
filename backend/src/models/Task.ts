import mongoose, { Document, Schema } from "mongoose";

export type Column = "TODO" | "IN_PROGRESS" | "DONE";

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface ITask extends Document {
  title: string;
  description?: string;
  column: Column;
  board: mongoose.Types.ObjectId;
  assignee?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  order: number;
  dueDate?: Date;
  priority: Priority;
  labels?: mongoose.Types.ObjectId[];
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String },
    column: { type: String, enum: ["TODO", "IN_PROGRESS", "DONE"], default: "TODO" },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true },
    assignee: { type: Schema.Types.ObjectId, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    order: { type: Number, default: 0 },
    dueDate: { type: Date },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    labels: [{ type: Schema.Types.ObjectId, ref: "Label" }],
  },
  { timestamps: true }
);

export default mongoose.model<ITask>("Task", TaskSchema);
