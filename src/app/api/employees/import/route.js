import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serializeEmployee } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/* ── EXACT Column Headers ──────────────────────────────── */
const EXPECTED_HEADERS = [
    "Name",
    "Father/Spouse Name",
    "Role",
    "Subject / Department",
    "Branch",
    "Phone",
    "Joining Date (DD/MM/YYYY)",
    "Base Salary",
    "Account Number",
    "IFSC Code",
    "Employment Status",
    "Address"
];

/* ── Generate next employee ID ─────────────────────────── */
async function generateEmployeeId(supabase, offset = 0) {
    const year = new Date().getFullYear();
    const prefix = `SBI-${year}-`;
    const { data: latest } = await supabase
        .from("employees")
        .select("employee_id")
        .ilike("employee_id", `${prefix}%`)
        .order("employee_id", { ascending: false })
        .limit(1)
        .maybeSingle();

    const lastSequence = latest?.employee_id
        ? Number(latest.employee_id.split("-").at(-1)) || 0
        : 0;
    return `${prefix}${String(lastSequence + 1 + offset).padStart(3, "0")}`;
}

/* ── Normalize a single row to an employee object ──────── */
function normalizeRow(row) {
    const rawName = String(row["Name"] ?? "").trim();
    const rawFather = String(row["Father/Spouse Name"] ?? "").trim();
    const rawSalary = String(row["Base Salary"] ?? "").replace(/[₹,\s]/g, "");

    if (!rawName || !rawFather || rawSalary === "") {
        return { error: "Mandatory fields missing (Name, Father/Spouse Name, or Base Salary)" };
    }

    const baseSalary = Number(rawSalary);
    if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
        return { error: "Base Salary must be a number greater than 0" };
    }

    const role = String(row["Role"] ?? "Staff").trim() || "Staff";
    const branch = String(row["Branch"] ?? "Branch 1").trim() || "Branch 1";

    let joiningDate = new Date().toISOString().slice(0, 10);
    const rawDate = row["Joining Date (DD/MM/YYYY)"];
    if (rawDate) {
        if (typeof rawDate === "number") {
            const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) joiningDate = d.toISOString().slice(0, 10);
        } else {
            const parts = String(rawDate).split(/[-/]/);
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) joiningDate = d.toISOString().slice(0, 10);
            }
        }
    }

    return {
        data: {
            name: rawName,
            father_or_spouse_name: rawFather,
            role,
            department: String(row["Subject / Department"] ?? "General").trim() || "General",
            branch,
            phone: String(row["Phone"] ?? "").trim() || "0000000000",
            address: String(row["Address"] ?? "").trim() || "N/A",
            joining_date: joiningDate,
            photo: null,
            bank_details: {
                accountNumber: String(row["Account Number"] ?? "").trim() || "0000000000",
                ifscCode: String(row["IFSC Code"] ?? "XXXX0000000").trim().toUpperCase()
            },
            base_salary: baseSalary,
            status: "Active"
        }
    };
}

/* ── POST /api/employees/import ────────────────────────── */
export async function POST(request) {
    const { response } = await requirePermission("employees.create");
    if (response) return response;

    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
            return NextResponse.json({ message: "No file uploaded." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return NextResponse.json({ message: "Excel file has no sheets." }, { status: 400 });
        }

        const headerRow = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })[0] || [];
        const missingHeaders = EXPECTED_HEADERS.filter((h) => !headerRow.includes(h));

        if (missingHeaders.length > 0) {
            return NextResponse.json({
                message: "Excel structure mismatch. Columns must match the template exactly.",
                errors: [{ row: 1, reason: `Missing columns: ${missingHeaders.join(", ")}` }]
            }, { status: 400 });
        }

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        const supabase = getSupabaseAdmin();
        const created = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];
            const hasData = Object.values(rowData).some((v) => String(v).trim() !== "");
            if (!hasData) continue;

            const normalized = normalizeRow(rowData);
            if (normalized.error) {
                errors.push({ row: i + 2, reason: normalized.error });
                continue;
            }

            const data = normalized.data;
            if (data.name.length < 2) {
                errors.push({ row: i + 2, reason: "Name is too short (min 2 chars)" });
                continue;
            }

            try {
                const employeeId = await generateEmployeeId(supabase, created.length);
                const { data: employee, error } = await supabase
                    .from("employees")
                    .insert({ ...data, employee_id: employeeId })
                    .select()
                    .single();

                if (error) {
                    errors.push({ row: i + 2, reason: error.message });
                } else {
                    created.push(serializeEmployee(employee));
                }
            } catch (err) {
                errors.push({ row: i + 2, reason: err.message?.slice(0, 120) || "Database error" });
            }
        }

        return NextResponse.json({
            message: `${created.length} employee(s) imported successfully.${errors.length ? ` ${errors.length} row(s) failed.` : ""}`,
            imported: created.length,
            errorCount: errors.length,
            errors: errors.slice(0, 50)
        }, { status: 201 });
    } catch (err) {
        console.error("Import error:", err);
        return NextResponse.json({ message: "Failed to process Excel file." }, { status: 500 });
    }
}
