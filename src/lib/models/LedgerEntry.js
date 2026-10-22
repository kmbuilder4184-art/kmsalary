import mongoose, { Schema } from "mongoose";

const LedgerEntrySchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    deductedAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, required: true, min: 0 },
    entryDate: { type: String, required: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["Open", "Closed"], default: "Open", index: true },
    closedAt: { type: String }
}, { timestamps: true, versionKey: false });

LedgerEntrySchema.index({ employeeId: 1, status: 1, entryDate: 1 });

export const LedgerEntryModel = mongoose.models.LedgerEntry ||
    mongoose.model("LedgerEntry", LedgerEntrySchema);
