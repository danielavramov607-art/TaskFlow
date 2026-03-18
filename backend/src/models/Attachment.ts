import mongoose, { Document, Schema } from "mongoose";

export interface IAttachment extends Document {
  task: mongoose.Types.ObjectId;
  uploader: mongoose.Types.ObjectId;
  url: string;
  publicId: string;
  filename: string;
  fileType: string;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    filename: { type: String, required: true },
    fileType: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IAttachment>("Attachment", AttachmentSchema);
