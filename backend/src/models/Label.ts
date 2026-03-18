import mongoose, { Document, Schema } from "mongoose";

export interface ILabel extends Document {
  board: mongoose.Types.ObjectId;
  name: string;
  color: string;
}

const LabelSchema = new Schema<ILabel>({
  board: { type: Schema.Types.ObjectId, ref: "Board", required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
});

export default mongoose.model<ILabel>("Label", LabelSchema);
