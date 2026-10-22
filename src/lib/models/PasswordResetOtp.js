import mongoose, { Schema } from "mongoose";

const PasswordResetOtpSchema = new Schema({
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: "" },
    attempts: { type: Number, default: 0, min: 0 },
    requestIp: { type: String, default: "", trim: true }
}, { timestamps: true, versionKey: false });

PasswordResetOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const PasswordResetOtpModel = mongoose.models.PasswordResetOtp ||
    mongoose.model("PasswordResetOtp", PasswordResetOtpSchema);
