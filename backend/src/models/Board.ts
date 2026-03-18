import mongoose, { Document, Schema } from "mongoose";

export interface IBoard extends Document {
  name: string;
  owner: mongoose.Types.ObjectId;
  collaborators: Array<{ user: mongoose.Types.ObjectId; role: "VIEWER" | "EDITOR" }>;
}

const BoardSchema = new Schema<IBoard>(
  {
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["VIEWER", "EDITOR"], required: true },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IBoard>("Board", BoardSchema);
