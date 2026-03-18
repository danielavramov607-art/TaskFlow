import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  task: mongoose.Types.ObjectId;
  board: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  text: string;
}

const CommentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IComment>("Comment", CommentSchema);
