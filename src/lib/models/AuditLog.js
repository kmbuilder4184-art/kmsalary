import mongoose, { Schema } from "mongoose";

const AuditLogSchema = new Schema({
    action: { type: String, required: true, index: true },
    actorEmail: { type: String, default: "", lowercase: true, trim: true, index: true },
    actorName: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Success", "Failed"], default: "Success", index: true },
    message: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "", trim: true }
}, { timestamps: true, versionKey: false });

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
