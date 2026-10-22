import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { getSupabaseAdmin } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
    const { user, response } = await requirePermission("admin.manage");
    if (response) return response;

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    const confirmation = String(formData?.get("confirmation") || "");

    if (confirmation !== "RESTORE") {
        return NextResponse.json({ message: "Type RESTORE to confirm." }, { status: 400 });
    }

    if (!file || typeof file.arrayBuffer !== "function") {
        return NextResponse.json({ message: "Backup file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength === 0) {
        return NextResponse.json({ message: "Backup file is empty." }, { status: 400 });
    }

    let jsonBuffer = buffer;
    if (isGzip(buffer) || String(file.name || "").endsWith(".gz")) {
        try {
            jsonBuffer = gunzipSync(buffer);
        } catch {
            return NextResponse.json({ message: "Backup gzip file could not be opened." }, { status: 400 });
        }
    }

    let backup;
    try {
        backup = JSON.parse(jsonBuffer.toString("utf8"));
    } catch {
        return NextResponse.json({ message: "Backup JSON is invalid." }, { status: 400 });
    }

    if (backup?.format !== "salary-management-backup") {
        return NextResponse.json({ message: "This file is not a valid Salary Software backup." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const restoredCounts = {};

    try {
        // If version 3 (Supabase native backup)
        if (backup.tables) {
            const tables = backup.tables;
            for (const [tableName, rows] of Object.entries(tables)) {
                if (!Array.isArray(rows) || rows.length === 0) continue;
                if (!["users", "employees", "salaries", "ledger_entries", "settings", "audit_logs"].includes(tableName)) continue;

                // Delete existing and insert
                await supabase.from(tableName).delete().neq("id", "00000000-0000-0000-0000-000000000000");
                const { error } = await supabase.from(tableName).insert(rows);
                if (!error) {
                    restoredCounts[tableName] = rows.length;
                }
            }
        }
        // If legacy collections backup (MongoDB format)
        else if (backup.collections) {
            const collections = backup.collections;

            // 1. Employees
            const rawEmployees = collections.employees || [];
            if (rawEmployees.length > 0) {
                await supabase.from("employees").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                const employeesToInsert = rawEmployees.map((emp) => ({
                    employee_id: emp.employeeId,
                    name: emp.name,
                    father_or_spouse_name: emp.fatherOrSpouseName || "N/A",
                    role: emp.role || "Staff",
                    department: emp.department || "General",
                    phone: emp.phone || "",
                    email: emp.email || "",
                    address: emp.address || "",
                    joining_date: emp.joiningDate || new Date().toISOString().slice(0, 10),
                    photo: emp.photo || null,
                    bank_details: emp.bankDetails || { accountNumber: "", ifscCode: "" },
                    base_salary: Number(emp.baseSalary || 0),
                    status: emp.status || "Active"
                }));
                await supabase.from("employees").insert(employeesToInsert);
                restoredCounts.employees = employeesToInsert.length;
            }

            // Fetch employee map for ID linkage
            const { data: allEmps } = await supabase.from("employees").select("id, employee_id");
            const empMap = new Map((allEmps || []).map((e) => [e.employee_id, e.id]));

            // 2. Salaries
            const rawSalaries = collections.salaries || [];
            if (rawSalaries.length > 0) {
                await supabase.from("salaries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                const salariesToInsert = rawSalaries.map((sal) => ({
                    employee_id: empMap.get(sal.employeeId) || null,
                    employee_code: sal.employeeId,
                    month: Number(sal.month),
                    year: Number(sal.year),
                    base_salary: Number(sal.baseSalary || 0),
                    working_days: Number(sal.workingDays || 1),
                    days_present: Number(sal.daysPresent || 0),
                    absent_days: Number(sal.absentDays || 0),
                    total_cl: Number(sal.totalCL || 14),
                    casual_leave: Number(sal.casualLeave || 0),
                    half_cl_taken: Number(sal.halfCLTaken || 0),
                    remaining_cl: Number(sal.remainingCL || 0),
                    excess_cl: Number(sal.excessCL || 0),
                    emergency_leave: Number(sal.emergencyLeave || 0),
                    bonus: Number(sal.bonus || 0),
                    advance_given: Number(sal.advanceGiven || 0),
                    previous_pending_advance: Number(sal.previousPendingAdvance || 0),
                    advance_deduction: Number(sal.advanceDeduction || 0),
                    ledger_deduction: Number(sal.ledgerDeduction || 0),
                    actual_ledger_deduction: Number(sal.actualLedgerDeduction || 0),
                    remaining_ledger_deduction: Number(sal.remainingLedgerDeduction || 0),
                    remaining_advance: Number(sal.remainingAdvance || 0),
                    carried_over_advance: Number(sal.carriedOverAdvance || 0),
                    unrecovered_advance: Number(sal.unrecoveredAdvance || 0),
                    pf_amount: Number(sal.pfAmount || 0),
                    absence_deduction: Number(sal.absenceDeduction || 0),
                    excess_cl_deduction: Number(sal.excessCLDeduction || 0),
                    total_deduction: Number(sal.totalDeduction || 0),
                    net_salary: Number(sal.netSalary || 0),
                    per_day_salary: Number(sal.perDaySalary || 0),
                    status: sal.status || "Pending",
                    payment_date: sal.paymentDate || null,
                    notes: sal.notes || ""
                }));
                await supabase.from("salaries").insert(salariesToInsert);
                restoredCounts.salaries = salariesToInsert.length;
            }

            // 3. Ledger
            const rawLedger = collections.ledgerentries || collections.ledger_entries || [];
            if (rawLedger.length > 0) {
                await supabase.from("ledger_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                const ledgerToInsert = rawLedger.map((l) => ({
                    employee_id: empMap.get(l.employeeId) || null,
                    employee_code: l.employeeId,
                    amount: Number(l.amount || 0),
                    deducted_amount: Number(l.deductedAmount || 0),
                    balance_amount: Number(l.balanceAmount || 0),
                    entry_date: l.entryDate || new Date().toISOString().slice(0, 10),
                    notes: l.notes || "",
                    status: l.status || "Open"
                }));
                await supabase.from("ledger_entries").insert(ledgerToInsert);
                restoredCounts.ledger_entries = ledgerToInsert.length;
            }

            // 4. Users
            const rawUsers = collections.users || [];
            if (rawUsers.length > 0) {
                for (const u of rawUsers) {
                    await supabase.from("users").upsert({
                        name: u.name,
                        email: u.email,
                        password_hash: u.passwordHash,
                        role: u.role || "User",
                        permissions: u.permissions || [],
                        status: u.status || "Active",
                        session_version: Number(u.sessionVersion || 0)
                    }, { onConflict: "email" });
                }
                restoredCounts.users = rawUsers.length;
            }

            // 5. Settings
            const rawSettings = collections.settings || [];
            if (rawSettings.length > 0) {
                for (const s of rawSettings) {
                    await supabase.from("settings").upsert({
                        key: s.key,
                        value: s.value || {}
                    }, { onConflict: "key" });
                }
                restoredCounts.settings = rawSettings.length;
            }
        }

        await writeAuditLog({
            action: "Restore",
            actor: user,
            message: "Database backup restored to Supabase.",
            metadata: { restoredTables: restoredCounts },
            request
        });

        return NextResponse.json({
            ok: true,
            restoredCollections: restoredCounts
        });
    } catch (err) {
        console.error("Restore error:", err);
        return NextResponse.json({ message: "Failed to restore backup.", error: err.message }, { status: 500 });
    }
}

function isGzip(buffer) {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}
