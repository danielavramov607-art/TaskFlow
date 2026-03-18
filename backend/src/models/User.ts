import mongoose, { Document, Schema } from "mongoose";
import { hash, compare } from "bcryptjs";

export interface IUser extends Document {
  email: string;
  name: string;
  password?: string;
  googleId?: string;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    password: { type: String },
    googleId: { type: String },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await hash(this.password, 12);
});

UserSchema.methods.comparePassword = function (password: string) {
  if (!this.password) return Promise.resolve(false);
  return compare(password, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);
