import mongoose, { Schema } from "mongoose";

const SettingSchema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });

export const SettingModel = mongoose.models.Setting || mongoose.model("Setting", SettingSchema);
