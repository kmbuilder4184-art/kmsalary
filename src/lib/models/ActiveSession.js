import mongoose, { Schema } from "mongoose";

const ActiveSessionSchema = new Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    userName: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true },
    sessionVersion: { type: Number, default: 0, min: 0 },
    ipAddress: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "", trim: true },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

ActiveSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ActiveSessionModel = mongoose.models.ActiveSession ||
    mongoose.model("ActiveSession", ActiveSessionSchema);
