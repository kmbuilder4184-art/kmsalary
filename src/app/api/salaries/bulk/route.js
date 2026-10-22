import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { applyLedgerDeduction, getEmployeeLedgerBalance } from "@/lib/ledger";
import { calculateSalary } from "@/lib/salary";
import { sendSalaryCreatedEmail } from "@/lib/salary-email";
import { serializeSalary } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";
import { getPreviousPendingAdvance } from "@/app/api/salaries/advance-pending/route";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
    workingDays: z.coerce.number().min(1).default(30),
    status: z.enum(["Paid", "Pending"]).default("Pending")
});

export async function POST(request) {
    const { response } = await requirePermission("salary.create");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid bulk salary details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("status", "Active");

    if (empError || !employees) {
        return NextResponse.json({ message: "Failed to fetch employees", error: empError?.message }, { status: 500 });
    }

    const employeeCodes = employees.map((emp) => emp.employee_id);

    const { data: existingSalaries } = await supabase
        .from("salaries")
        .select("employee_code")
        .eq("month", parsed.data.month)
        .eq("year", parsed.data.year)
        .in("employee_code", employeeCodes);

    const existingCodes = new Set((existingSalaries || []).map((sal) => sal.employee_code));
    const employeesToProcess = employees.filter((emp) => !existingCodes.has(emp.employee_id));

    const docs = await Promise.all(employeesToProcess.map(async (employee) => {
        const previousPendingAdvance = await getPreviousPendingAdvance(
            employee.employee_id,
            parsed.data.month,
            parsed.data.year
        );
        const ledgerBal = await getEmployeeLedgerBalance(employee.employee_id);

        const calculation = calculateSalary({
            month: parsed.data.month,
            annualClUsed: 0,
            baseSalary: Number(employee.base_salary || 0),
            workingDays: parsed.data.workingDays,
            daysPresent: parsed.data.workingDays,
            casualLeave: 0,
            halfCLTaken: 0,
            excessCL: 0,
            emergencyLeave: 0,
            bonus: 0,
            advanceGiven: 0,
            previousPendingAdvance,
            advanceDeduction: 0,
            ledgerDeduction: ledgerBal
        });

        return {
            employee_id: employee.id,
            employee_code: employee.employee_id,
            month: parsed.data.month,
            year: parsed.data.year,
            base_salary: Number(employee.base_salary || 0),
            working_days: parsed.data.workingDays,
            days_present: parsed.data.workingDays,
            absent_days: calculation.absentDays,
            total_cl: 14,
            casual_leave: 0,
            half_cl_taken: 0,
            remaining_cl: calculation.remainingCL,
            excess_cl: 0,
            emergency_leave: 0,
            bonus: 0,
            advance_given: 0,
            previous_pending_advance: calculation.previousPendingAdvance,
            advance_deduction: 0,
            ledger_deduction: calculation.ledgerDeduction,
            actual_ledger_deduction: calculation.actualLedgerDeduction,
            remaining_ledger_deduction: calculation.remainingLedgerDeduction,
            remaining_advance: calculation.remainingAdvance,
            carried_over_advance: 0,
            unrecovered_advance: 0,
            absence_deduction: calculation.absenceDeduction,
            excess_cl_deduction: calculation.excessCLDeduction,
            total_deduction: calculation.totalDeduction,
            net_salary: calculation.netSalary,
            per_day_salary: calculation.perDaySalary,
            status: parsed.data.status,
            payment_date: parsed.data.status === "Paid" ? new Date().toISOString() : null,
            _employeeRef: employee
        };
    }));

    if (docs.length > 0) {
        const insertPayloads = docs.map(({ _employeeRef, ...payload }) => payload);
        const { data: createdSalaries, error: insertError } = await supabase
            .from("salaries")
            .insert(insertPayloads)
            .select("*, employees:employee_id(*)");

        if (insertError) {
            console.error("Bulk salary insert error:", insertError);
            return NextResponse.json({ message: "Failed to create bulk salaries.", error: insertError.message }, { status: 500 });
        }

        await Promise.all(docs.map((doc) => applyLedgerDeduction(doc.employee_code, doc.actual_ledger_deduction || 0)));

        const salariesToEmail = (createdSalaries || []).map((sal) => {
            sal.employee = sal.employees;
            return serializeSalary(sal);
        });

        const emailResults = await Promise.allSettled(
            salariesToEmail.map((salary) => sendSalaryCreatedEmail({ salary, request }))
        );

        await Promise.all(emailResults.map(async (result, index) => {
            if (result.status !== "fulfilled" || !result.value?.sent) return null;
            const targetSalary = createdSalaries[index];
            if (!targetSalary) return null;
            return supabase
                .from("salaries")
                .update({
                    salary_email_sent_at: new Date().toISOString(),
                    salary_email_sent_to: result.value.to
                })
                .eq("id", targetSalary.id);
        }));

        const sentEmails = emailResults.filter((r) => r.status === "fulfilled" && r.value?.sent).length;

        return NextResponse.json({
            created: docs.length,
            skipped: existingCodes.size,
            totalActiveEmployees: employees.length,
            sentEmails
        });
    }

    return NextResponse.json({
        created: 0,
        skipped: existingCodes.size,
        totalActiveEmployees: employees.length,
        sentEmails: 0
    });
}
