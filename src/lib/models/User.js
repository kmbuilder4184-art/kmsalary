import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Admin", "User"], default: "User", index: true },
    permissions: [{ type: String, trim: true }],
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    sessionVersion: { type: Number, default: 0, min: 0 }
}, { timestamps: true, versionKey: false });

export const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
