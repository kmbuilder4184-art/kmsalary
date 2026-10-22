import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load .env.local or .env
if (fs.existsSync(".env.local")) {
    dotenv.config({ path: ".env.local" });
} else {
    dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\n❌ Error: Supabase credentials missing in .env.local!");
    console.error("Please add:");
    console.error("  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
    console.error("  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function runMigration() {
    console.log("==================================================");
    console.log("🚀 STARTING MIGRATION TO SUPABASE POSTGRESQL");
    console.log("==================================================");

    const backupFile = process.argv[2] || path.join(process.cwd(), "database_backup.json");
    if (!fs.existsSync(backupFile)) {
        console.error(`\n❌ Backup file not found at: ${backupFile}`);
        console.error("If you have a backup at another path, run: node scripts/migrate-to-supabase.js <path-to-file>\n");
        process.exit(1);
    }

    console.log(`📂 Reading backup file: ${backupFile}...`);
    const rawBuffer = fs.readFileSync(backupFile);
    const rawData = backupFile.endsWith(".gz")
        ? zlib.gunzipSync(rawBuffer).toString("utf-8")
        : rawBuffer.toString("utf-8");
    let backup;
    try {
        backup = JSON.parse(rawData);
    } catch (err) {
        console.error("❌ Failed to parse JSON backup:", err.message);
        process.exit(1);
    }

    const collections = backup.collections || backup.tables || {};
    const numberValue = (value, fallback = 0) => {
        if (value === undefined || value === null || value === "") return fallback;
        if (typeof value === "object") {
            const raw = value.$numberInt ?? value.$numberLong ?? value.$numberDouble ?? value.$numberDecimal;
            if (raw !== undefined) return Number(raw);
        }
        return Number(value);
    };
    const dateValue = (value) => {
        if (!value) return null;
        if (typeof value === "object" && value.$date) {
            const raw = value.$date.$numberLong ?? value.$date;
            return new Date(Number(raw)).toISOString();
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };
    const dateOnly = (value) => dateValue(value)?.slice(0, 10) || value || null;

    // 1. Migrate Users
    console.log("\n👤 1. Migrating Users...");
    const rawUsers = collections.users || [];
    let usersMigrated = 0;
    for (const u of rawUsers) {
        const { error } = await supabase.from("users").upsert({
            name: u.name,
            email: String(u.email || "").toLowerCase().trim(),
            password_hash: u.passwordHash || u.password_hash,
            role: u.role || "User",
            permissions: u.permissions || [],
            status: u.status || "Active",
            session_version: numberValue(u.sessionVersion ?? u.session_version, 0),
            created_at: dateValue(u.createdAt ?? u.created_at) || undefined,
            updated_at: dateValue(u.updatedAt ?? u.updated_at) || undefined
        }, { onConflict: "email" });

        if (error) {
            console.error(`  ⚠️ User ${u.email} error:`, error.message);
        } else {
            usersMigrated++;
        }
    }
    console.log(`  ✅ Users migrated: ${usersMigrated}/${rawUsers.length}`);

    // 2. Migrate Employees
    console.log("\n👔 2. Migrating Employees...");
    const rawEmployees = collections.employees || [];
    let empsMigrated = 0;
    for (const emp of rawEmployees) {
        const bank = emp.bankDetails || emp.bank_details || {};
        const { error } = await supabase.from("employees").upsert({
            employee_id: emp.employeeId || emp.employee_id,
            name: emp.name,
            father_or_spouse_name: emp.fatherOrSpouseName || emp.father_or_spouse_name || "N/A",
            role: emp.role || "Staff",
            department: emp.department || "General",
            phone: emp.phone || "",
            email: emp.email || "",
            address: emp.address || "",
            joining_date: emp.joiningDate || emp.joining_date || new Date().toISOString().slice(0, 10),
            photo: emp.photo || null,
            bank_details: {
                accountNumber: bank.accountNumber || bank.account_number || "",
                ifscCode: (bank.ifscCode || bank.ifsc_code || "").toUpperCase()
            },
            base_salary: numberValue(emp.baseSalary ?? emp.base_salary, 0),
            status: emp.status || "Active",
            created_at: dateValue(emp.createdAt ?? emp.created_at) || undefined,
            updated_at: dateValue(emp.updatedAt ?? emp.updated_at) || undefined
        }, { onConflict: "employee_id" });

        if (error) {
            console.error(`  ⚠️ Employee ${emp.employeeId} error:`, error.message);
        } else {
            empsMigrated++;
        }
    }
    console.log(`  ✅ Employees migrated: ${empsMigrated}/${rawEmployees.length}`);

    // Fetch employee map
    const { data: dbEmps } = await supabase.from("employees").select("id, employee_id");
    const empMap = new Map((dbEmps || []).map((e) => [e.employee_id, e.id]));

    // 3. Migrate Salaries
    console.log("\n💰 3. Migrating Salary Records...");
    const rawSalaries = collections.salaries || [];
    let salariesMigrated = 0;
    const batchSize = 100;
    for (let i = 0; i < rawSalaries.length; i += batchSize) {
        const chunk = rawSalaries.slice(i, i + batchSize);
        const records = chunk.map((sal) => {
            const empCode = sal.employeeId || sal.employee_code;
            return {
                employee_id: empMap.get(empCode) || null,
                employee_code: empCode,
                month: numberValue(sal.month), year: numberValue(sal.year),
                base_salary: numberValue(sal.baseSalary ?? sal.base_salary), working_days: numberValue(sal.workingDays ?? sal.working_days, 1),
                days_present: numberValue(sal.daysPresent ?? sal.days_present), absent_days: numberValue(sal.absentDays ?? sal.absent_days),
                total_cl: numberValue(sal.totalCL ?? sal.total_cl, 14), casual_leave: numberValue(sal.casualLeave ?? sal.casual_leave), half_cl_taken: numberValue(sal.halfCLTaken ?? sal.half_cl_taken),
                remaining_cl: numberValue(sal.remainingCL ?? sal.remaining_cl), excess_cl: numberValue(sal.excessCL ?? sal.excess_cl), emergency_leave: numberValue(sal.emergencyLeave ?? sal.emergency_leave),
                bonus: numberValue(sal.bonus), advance_given: numberValue(sal.advanceGiven ?? sal.advance_given), previous_pending_advance: numberValue(sal.previousPendingAdvance ?? sal.previous_pending_advance),
                advance_deduction: numberValue(sal.advanceDeduction ?? sal.advance_deduction), ledger_deduction: numberValue(sal.ledgerDeduction ?? sal.ledger_deduction), actual_ledger_deduction: numberValue(sal.actualLedgerDeduction ?? sal.actual_ledger_deduction),
                remaining_ledger_deduction: numberValue(sal.remainingLedgerDeduction ?? sal.remaining_ledger_deduction), remaining_advance: numberValue(sal.remainingAdvance ?? sal.remaining_advance), carried_over_advance: numberValue(sal.carriedOverAdvance ?? sal.carried_over_advance),
                unrecovered_advance: numberValue(sal.unrecoveredAdvance ?? sal.unrecovered_advance), pf_amount: numberValue(sal.pfAmount ?? sal.pf_amount), absence_deduction: numberValue(sal.absenceDeduction ?? sal.absence_deduction),
                excess_cl_deduction: numberValue(sal.excessCLDeduction ?? sal.excess_cl_deduction), total_deduction: numberValue(sal.totalDeduction ?? sal.total_deduction), net_salary: numberValue(sal.netSalary ?? sal.net_salary), per_day_salary: numberValue(sal.perDaySalary ?? sal.per_day_salary),
                status: sal.status === "Paid" ? "Paid" : "Pending",
                payment_date: dateOnly(sal.paymentDate ?? sal.payment_date), notes: sal.notes || "",
                created_at: dateValue(sal.createdAt ?? sal.created_at) || undefined, updated_at: dateValue(sal.updatedAt ?? sal.updated_at) || undefined
            };
        });

        const { error } = await supabase.from("salaries").upsert(records, {
            onConflict: "employee_code,month,year"
        });

        if (error) {
            console.error(`  ⚠️ Salary batch ${i / batchSize + 1} error:`, error.message);
        } else {
            salariesMigrated += records.length;
        }
    }
    console.log(`  ✅ Salaries migrated: ${salariesMigrated}/${rawSalaries.length}`);

    // 4. Migrate Ledger Entries
    console.log("\n📖 4. Migrating Ledger Entries...");
    const rawLedger = collections.ledgerentries || collections.ledger_entries || [];
    let ledgerMigrated = 0;
    for (const l of rawLedger) {
        const empCode = l.employeeId || l.employee_code;
        const { error } = await supabase.from("ledger_entries").insert({
            employee_id: empMap.get(empCode) || null,
            employee_code: empCode,
            amount: numberValue(l.amount), deducted_amount: numberValue(l.deductedAmount ?? l.deducted_amount), balance_amount: numberValue(l.balanceAmount ?? l.balance_amount),
            entry_date: dateOnly(l.entryDate ?? l.entry_date) || new Date().toISOString().slice(0, 10),
            notes: l.notes || "",
            status: l.status || "Open",
            closed_at: dateOnly(l.closedAt ?? l.closed_at), created_at: dateValue(l.createdAt ?? l.created_at) || undefined, updated_at: dateValue(l.updatedAt ?? l.updated_at) || undefined
        });

        if (error) {
            console.error(`  ⚠️ Ledger entry error:`, error.message);
        } else {
            ledgerMigrated++;
        }
    }
    console.log(`  ✅ Ledger entries migrated: ${ledgerMigrated}/${rawLedger.length}`);

    // 5. Migrate Settings
    console.log("\n⚙️ 5. Migrating Settings...");
    const rawSettings = collections.settings || [];
    let settingsMigrated = 0;
    for (const s of rawSettings) {
        const { error } = await supabase.from("settings").upsert({
            key: s.key,
            value: s.value || {}, created_at: dateValue(s.createdAt ?? s.created_at) || undefined, updated_at: dateValue(s.updatedAt ?? s.updated_at) || undefined
        }, { onConflict: "key" });

        if (error) {
            console.error(`  ⚠️ Setting ${s.key} error:`, error.message);
        } else {
            settingsMigrated++;
        }
    }
    console.log(`  ✅ Settings migrated: ${settingsMigrated}/${rawSettings.length}`);

    // 6. Historical audit log (active sessions are intentionally not restored).
    console.log("\n📋 6. Migrating Audit Logs...");
    const rawAuditLogs = collections.auditlogs || collections.audit_logs || [];
    const auditRecords = rawAuditLogs.map((log) => ({
        action: log.action || "Unknown", actor_email: log.actorEmail || log.actor_email || "",
        actor_name: log.actorName || log.actor_name || "", status: log.status === "Failed" ? "Failed" : "Success",
        message: log.message || "", metadata: log.metadata || {}, ip_address: log.ipAddress || log.ip_address || "",
        user_agent: log.userAgent || log.user_agent || "", created_at: dateValue(log.createdAt ?? log.created_at) || undefined
    }));
    const { error: auditError } = auditRecords.length ? await supabase.from("audit_logs").insert(auditRecords) : { error: null };
    if (auditError) console.error("  ⚠️ Audit logs error:", auditError.message);
    else console.log(`  ✅ Audit logs migrated: ${auditRecords.length}/${rawAuditLogs.length}`);

    console.log("\n==================================================");
    console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
}

runMigration().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
