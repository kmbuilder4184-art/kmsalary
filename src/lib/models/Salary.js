import mongoose, { Schema } from "mongoose";
const SalarySchema = new Schema({
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    baseSalary: { type: Number, required: true, min: 0 },
    workingDays: { type: Number, required: true, min: 1 },
    daysPresent: { type: Number, required: true, min: 0 },
    absentDays: { type: Number, required: true, min: 0 },
    totalCL: { type: Number, default: 14, min: 0 },
    casualLeave: { type: Number, default: 0, min: 0 },
    halfCLTaken: { type: Number, default: 0, min: 0 },
    remainingCL: { type: Number, default: 0, min: 0 },
    excessCL: { type: Number, default: 0, min: 0 },
    emergencyLeave: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    advanceGiven: { type: Number, default: 0, min: 0 },
    previousPendingAdvance: { type: Number, default: 0, min: 0 },
    advanceDeduction: { type: Number, default: 0, min: 0 },
    ledgerDeduction: { type: Number, default: 0, min: 0 },
    actualLedgerDeduction: { type: Number, default: 0, min: 0 },
    remainingLedgerDeduction: { type: Number, default: 0, min: 0 },
    remainingAdvance: { type: Number, default: 0, min: 0 },
    carriedOverAdvance: { type: Number, default: 0, min: 0 },
    unrecoveredAdvance: { type: Number, default: 0, min: 0 },
    pfAmount: { type: Number, default: 0, min: 0 },
    absenceDeduction: { type: Number, default: 0, min: 0 },
    excessCLDeduction: { type: Number, default: 0, min: 0 },
    totalDeduction: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true, min: 0 },
    perDaySalary: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["Paid", "Pending"], default: "Pending", index: true },
    paymentDate: { type: String },
    salaryEmailSentAt: { type: String },
    salaryEmailSentTo: { type: String, default: "", lowercase: true, trim: true },
    notes: { type: String, trim: true }
}, { timestamps: true, versionKey: false });
SalarySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
SalarySchema.index({ year: -1, month: -1, createdAt: -1 });
SalarySchema.index({ status: 1, year: -1, month: -1 });
export const SalaryModel = mongoose.models.Salary
    ? (mongoose.models.Salary.schema.path("salaryEmailSentAt") ? mongoose.models.Salary : (delete mongoose.models.Salary, mongoose.model("Salary", SalarySchema)))
    : mongoose.model("Salary", SalarySchema);
