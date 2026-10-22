import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { applyLedgerDeduction, getEmployeeLedgerBalance } from "@/lib/ledger";
import { ANNUAL_CL_ALLOWANCE, calculateSalary, sumAllowedClUsed, validateClRequest } from "@/lib/salary";
import { parseEsslSalaryNote } from "@/lib/essl-salary/report-data";
import { sendSalaryCreatedEmail } from "@/lib/salary-email";
import { serializeSalary } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";
import { getPreviousPendingAdvance } from "@/app/api/salaries/advance-pending/route";

export const dynamic = "force-dynamic";

const salarySchema = z.object({
    employee: z.string().min(1),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
    baseSalary: z.coerce.number().min(0),
    workingDays: z.coerce.number().min(1),
    daysPresent: z.coerce.number().min(0),
    totalCL: z.coerce.number().min(0).default(ANNUAL_CL_ALLOWANCE),
    casualLeave: z.coerce.number().min(0).max(2).default(0),
    halfCLTaken: z.coerce.number().min(0).default(0),
    excessCL: z.coerce.number().min(0).default(0),
    emergencyLeave: z.coerce.number().min(0).default(0),
    bonus: z.coerce.number().min(0).default(0),
    esslCalculatedNet: z.coerce.number().min(0).optional(),
    esslAdvanceRemaining: z.coerce.number().min(0).optional(),
    advanceGiven: z.coerce.number().min(0).default(0),
    advanceDeduction: z.coerce.number().min(0).default(0),
    pfAmount: z.coerce.number().min(0).default(0),
    status: z.enum(["Paid", "Pending"]).default("Pending"),
    paymentDate: z.string().optional().nullable(),
    notes: z.string().optional()
});

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit")) || 0, 1000);

    let query = supabase
        .from("salaries")
        .select(`
            *,
            employees:employee_id (
                id,
                employee_id,
                name,
                role,
                department,
                phone,
                email,
                base_salary,
                status,
                created_at,
                updated_at
            )
        `)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("created_at", { ascending: false });

    if (employeeId) {
        query = query.eq("employee_code", employeeId);
    }
    if (month) {
        query = query.eq("month", Number(month));
    }
    if (year) {
        query = query.eq("year", Number(year));
    }
    if (status === "Paid" || status === "Pending") {
        query = query.eq("status", status);
    }
    if (limit > 0) {
        query = query.limit(limit);
    }

    const { data: salaries, error } = await query;

    if (error) {
        console.error("Supabase salaries fetch error:", error);
        return NextResponse.json({ message: "Failed to fetch salaries", error: error.message }, { status: 500 });
    }

    const activeEmployeeSalaries = (salaries || [])
        .map((sal) => ({
            ...sal,
            employee: sal.employees
        }))
        .map(serializeSalary)
        .filter((salary) => salary.employee?.status === "Active");

    return NextResponse.json({ salaries: activeEmployeeSalaries });
}

export async function POST(request) {
    const { response } = await requirePermission("salary.create");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const parsed = salarySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid salary details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.data.employee);
    let empQuery = supabase.from("employees").select("*").eq("status", "Active");
    if (isUuid) {
        empQuery = empQuery.eq("id", parsed.data.employee);
    } else {
        empQuery = empQuery.or(`id.eq.${parsed.data.employee},employee_id.eq.${parsed.data.employee}`);
    }

    const { data: employee } = await empQuery.maybeSingle();

    if (!employee) {
        return NextResponse.json({ message: "Active employee not found." }, { status: 404 });
    }

    const { data: annualClRecordsRaw } = await supabase
        .from("salaries")
        .select("month, casual_leave, half_cl_taken")
        .eq("employee_code", employee.employee_id)
        .eq("year", parsed.data.year)
        .neq("month", parsed.data.month);

    const annualClRecords = (annualClRecordsRaw || []).map((r) => ({
        month: r.month,
        casualLeave: Number(r.casual_leave || 0),
        halfCLTaken: Number(r.half_cl_taken || 0)
    }));

    const clError = validateClRequest({
        casualLeave: parsed.data.casualLeave,
        halfCLTaken: parsed.data.halfCLTaken,
        annualClUsed: sumAllowedClUsed(annualClRecords),
        totalCL: parsed.data.totalCL
    });

    if (clError) {
        return NextResponse.json({ message: clError }, { status: 400 });
    }

    const previousPendingAdvance = await getPreviousPendingAdvance(
        String(employee.employee_id),
        parsed.data.month,
        parsed.data.year
    );

    const { data: existingSalary } = await supabase
        .from("salaries")
        .select("*")
        .eq("employee_code", employee.employee_id)
        .eq("month", parsed.data.month)
        .eq("year", parsed.data.year)
        .maybeSingle();

    const isEsslSubmission = String(parsed.data.notes || "").includes("ESSL Calculator:");
    const existingIsEsslSalary = String(existingSalary?.notes || "").includes("ESSL Calculator:");
    if (existingSalary?.id && isEsslSubmission && existingIsEsslSalary) {
        return NextResponse.json({
            message: "A salary record already exists for this employee and month. Delete the existing record before creating it again."
        }, { status: 409 });
    }

    const ledgerDeduction = Number(existingSalary?.ledger_deduction || 0) > 0
        ? Number(existingSalary.ledger_deduction)
        : await getEmployeeLedgerBalance(employee.employee_id);

    const totalPendingAdvance = previousPendingAdvance + ledgerDeduction + parsed.data.advanceGiven;
    if (parsed.data.advanceDeduction > totalPendingAdvance) {
        return NextResponse.json({
            message: `Advance deduction (₹${parsed.data.advanceDeduction}) cannot exceed total pending advance (₹${totalPendingAdvance}).`
        }, { status: 400 });
    }

    const calculation = calculateSalary({
        month: parsed.data.month,
        annualClUsed: sumAllowedClUsed(annualClRecords),
        totalCL: parsed.data.totalCL,
        baseSalary: parsed.data.baseSalary,
        workingDays: parsed.data.workingDays,
        daysPresent: parsed.data.daysPresent,
        casualLeave: parsed.data.casualLeave,
        halfCLTaken: parsed.data.halfCLTaken,
        excessCL: parsed.data.excessCL,
        emergencyLeave: parsed.data.emergencyLeave,
        bonus: parsed.data.bonus,
        advanceGiven: parsed.data.advanceGiven,
        previousPendingAdvance,
        advanceDeduction: parsed.data.advanceDeduction,
        ledgerDeduction,
        pfAmount: parsed.data.pfAmount
    });
    const esslPayroll = parseEsslSalaryNote(parsed.data.notes);

    const payload = {
        employee_id: employee.id,
        employee_code: String(employee.employee_id),
        month: parsed.data.month,
        year: parsed.data.year,
        base_salary: parsed.data.baseSalary,
        working_days: parsed.data.workingDays,
        days_present: parsed.data.daysPresent,
        absent_days: esslPayroll?.unpaidAbsenceDays ?? calculation.absentDays,
        total_cl: parsed.data.totalCL,
        casual_leave: parsed.data.casualLeave,
        half_cl_taken: parsed.data.halfCLTaken,
        remaining_cl: calculation.remainingCL,
        excess_cl: parsed.data.excessCL,
        emergency_leave: parsed.data.emergencyLeave,
        bonus: parsed.data.bonus,
        advance_given: parsed.data.advanceGiven,
        previous_pending_advance: calculation.previousPendingAdvance,
        advance_deduction: esslPayroll?.advanceDeduction ?? calculation.advanceDeduction,
        ledger_deduction: calculation.ledgerDeduction,
        actual_ledger_deduction: calculation.actualLedgerDeduction,
        remaining_ledger_deduction: calculation.remainingLedgerDeduction,
        remaining_advance: parsed.data.esslAdvanceRemaining ?? calculation.remainingAdvance,
        carried_over_advance: 0,
        unrecovered_advance: 0,
        pf_amount: parsed.data.pfAmount,
        absence_deduction: esslPayroll?.absenceDeduction ?? calculation.absenceDeduction,
        excess_cl_deduction: calculation.excessCLDeduction,
        total_deduction: esslPayroll?.deductions ?? calculation.totalDeduction,
        net_salary: parsed.data.esslCalculatedNet ?? calculation.netSalary,
        per_day_salary: esslPayroll?.dailyRate ?? calculation.perDaySalary,
        status: parsed.data.status,
        payment_date: parsed.data.status === "Paid" ? parsed.data.paymentDate || new Date().toISOString() : null,
        notes: parsed.data.notes || ""
    };

    let salaryResult;
    if (existingSalary?.id) {
        const { data: updated, error } = await supabase
            .from("salaries")
            .update(payload)
            .eq("id", existingSalary.id)
            .select("*, employees:employee_id(*)")
            .single();

        if (error) {
            return NextResponse.json({ message: "Failed to update salary.", error: error.message }, { status: 500 });
        }
        salaryResult = updated;
    } else {
        const { data: inserted, error } = await supabase
            .from("salaries")
            .insert(payload)
            .select("*, employees:employee_id(*)")
            .single();

        if (error) {
            return NextResponse.json({ message: "Failed to create salary.", error: error.message }, { status: 500 });
        }
        salaryResult = inserted;
    }

    if (!existingSalary || Number(existingSalary.actual_ledger_deduction || 0) === 0) {
        await applyLedgerDeduction(employee.employee_id, calculation.actualLedgerDeduction);
    }

    salaryResult.employee = salaryResult.employees || employee;
    const serializedSalary = serializeSalary(salaryResult);

    let emailStatus = { sent: false, reason: "Employee email is not available." };
    try {
        emailStatus = await sendSalaryCreatedEmail({ salary: serializedSalary, request });
        if (emailStatus.sent) {
            await supabase
                .from("salaries")
                .update({
                    salary_email_sent_at: new Date().toISOString(),
                    salary_email_sent_to: emailStatus.to
                })
                .eq("id", salaryResult.id);

            serializedSalary.salaryEmailSentAt = new Date().toISOString();
            serializedSalary.salaryEmailSentTo = emailStatus.to;
        }
    } catch (error) {
        emailStatus = { sent: false, reason: error.message || "Salary email could not be sent." };
    }

    return NextResponse.json({ salary: serializedSalary, emailStatus }, { status: 201 });
}
