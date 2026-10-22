import mongoose, { Schema } from "mongoose";
const EmployeeSchema = new Schema({
    name: { type: String, required: true, trim: true },
    fatherOrSpouseName: { type: String, default: "N/A", trim: true },
    employeeId: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["Teacher", "Staff"], default: "Staff" },
    department: { type: String, default: "General", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    address: { type: String, default: "", trim: true },
    joiningDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    photo: { type: String },
    bankDetails: {
        accountNumber: { type: String, default: "", trim: true },
        ifscCode: { type: String, default: "", trim: true, uppercase: true }
    },
    baseSalary: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true, versionKey: false });
EmployeeSchema.index({ name: "text", employeeId: "text", department: "text" });
EmployeeSchema.index({ status: 1, name: 1 });
export const EmployeeModel = mongoose.models.Employee
    ? (mongoose.models.Employee.schema.path("email") ? mongoose.models.Employee : (delete mongoose.models.Employee, mongoose.model("Employee", EmployeeSchema)))
    : mongoose.model("Employee", EmployeeSchema);
