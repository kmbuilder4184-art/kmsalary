import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ANNUAL_CL_ALLOWANCE, calculateSalary, sumAllowedClUsed, validateClRequest } from "@/lib/salary";
import { serializeSalary } from "@/lib/serializers";
import { getCurrentUser, requirePermission } from "@/lib/server-auth";
import { validateCredentials } from "@/lib/auth";
import { sendSalaryCreatedEmail } from "@/lib/salary-email";
import { getPreviousPendingAdvance } from "@/app/api/salaries/advance-pending/route";

export const dynamic = "force-dynamic";

const salaryPatchSchema = z.object({
    baseSalary: z.coerce.number().min(0).optional(),
    workingDays: z.coerce.number().min(1).optional(),
    daysPresent: z.coerce.number().min(0).optional(),
    totalCL: z.coerce.number().min(0).optional(),
    casualLeave: z.coerce.number().min(0).max(2).optional(),
    halfCLTaken: z.coerce.number().min(0).optional(),
    excessCL: z.coerce.number().min(0).optional(),
    emergencyLeave: z.coerce.number().min(0).optional(),
    bonus: z.coerce.number().min(0).optional(),
    advanceGiven: z.coerce.number().min(0).optional(),
    advanceDeduction: z.coerce.number().min(0).optional(),
    pfAmount: z.coerce.number().min(0).optional(),
    status: z.enum(["Paid", "Pending"]).optional(),
    paymentDate: z.string().optional().nullable(),
    notes: z.string().optional(),
    password: z.string().min(1)
});

async function findSalaryById(supabase, id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
        `);

    if (isUuid) {
        query = query.eq("id", id);
    } else {
        query = query.or(`id.eq.${id}`);
    }

    const { data } = await query.maybeSingle();
    if (!data) return null;
    return {
        ...data,
        employee: data.employees
    };
}

export async function GET(_, context) {
    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const salary = await findSalaryById(supabase, id);

    if (!salary) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }

    return NextResponse.json({ salary: serializeSalary(salary) });
}

export async function POST(request, context) {
    const permission = await requirePermission("salary.view");
    if (permission.response) return permission.response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const salary = await findSalaryById(supabase, id);

    if (!salary) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }

    try {
        const serialized = serializeSalary(salary);
        const result = await sendSalaryCreatedEmail({ salary: serialized, request });
        if (!result.sent) {
            return NextResponse.json({ message: result.reason || "Employee email is not available." }, { status: 400 });
        }

        await supabase
            .from("salaries")
            .update({
                salary_email_sent_at: new Date().toISOString(),
                salary_email_sent_to: result.to
            })
            .eq("id", salary.id);

        return NextResponse.json({ ok: true, emailStatus: result });
    } catch (error) {
        return NextResponse.json({ message: error.message || "Salary email could not be sent." }, { status: 500 });
    }
}

export async function PATCH(request, context) {
    const permission = await requirePermission("salary.edit");
    if (permission.response) return permission.response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const existing = await findSalaryById(supabase, id);

    if (!existing) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }

    const parsed = salaryPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid salary details.", errors: parsed.error.flatten() }, { status: 400 });
    }

    const passwordResponse = await requirePassword(parsed.data.password);
    if (passwordResponse) return passwordResponse;

    const { password: _password, ...salaryData } = parsed.data;
    const merged = {
        month: existing.month,
        baseSalary: salaryData.baseSalary ?? Number(existing.base_salary || 0),
        workingDays: salaryData.workingDays ?? Number(existing.working_days || 1),
        daysPresent: salaryData.daysPresent ?? Number(existing.days_present || 0),
        totalCL: salaryData.totalCL ?? Number(existing.total_cl || ANNUAL_CL_ALLOWANCE),
        casualLeave: salaryData.casualLeave ?? Number(existing.casual_leave || 0),
        halfCLTaken: salaryData.halfCLTaken ?? Number(existing.half_cl_taken || 0),
        excessCL: salaryData.excessCL ?? Number(existing.excess_cl || 0),
        emergencyLeave: salaryData.emergencyLeave ?? Number(existing.emergency_leave || 0),
        bonus: salaryData.bonus ?? Number(existing.bonus || 0),
        advanceGiven: salaryData.advanceGiven ?? Number(existing.advance_given || 0),
        advanceDeduction: salaryData.advanceDeduction ?? Number(existing.advance_deduction || 0),
        ledgerDeduction: Number(existing.ledger_deduction || 0),
        pfAmount: salaryData.pfAmount ?? Number(existing.pf_amount || 0)
    };

    const { data: annualClRecordsRaw } = await supabase
        .from("salaries")
        .select("month, casual_leave, half_cl_taken")
        .eq("employee_code", existing.employee_code)
        .eq("year", existing.year)
        .neq("id", existing.id);

    const annualClRecords = (annualClRecordsRaw || []).map((r) => ({
        month: r.month,
        casualLeave: Number(r.casual_leave || 0),
        halfCLTaken: Number(r.half_cl_taken || 0)
    }));

    const clError = validateClRequest({
        casualLeave: merged.casualLeave,
        halfCLTaken: merged.halfCLTaken,
        annualClUsed: sumAllowedClUsed(annualClRecords),
        totalCL: merged.totalCL
    });

    if (clError) {
        return NextResponse.json({ message: clError }, { status: 400 });
    }

    const previousPendingAdvance = await getPreviousPendingAdvance(
        existing.employee_code,
        existing.month,
        existing.year
    );

    const totalPendingAdvance = previousPendingAdvance + merged.ledgerDeduction + merged.advanceGiven;
    if (merged.advanceDeduction > totalPendingAdvance) {
        return NextResponse.json({
            message: `Advance deduction (₹${merged.advanceDeduction}) cannot exceed total pending advance (₹${totalPendingAdvance}).`
        }, { status: 400 });
    }

    const calculation = calculateSalary({
        ...merged,
        previousPendingAdvance,
        annualClUsed: sumAllowedClUsed(annualClRecords)
    });

    const updatePayload = {
        base_salary: merged.baseSalary,
        working_days: merged.workingDays,
        days_present: merged.daysPresent,
        absent_days: calculation.absentDays,
        total_cl: merged.totalCL,
        casual_leave: merged.casualLeave,
        half_cl_taken: merged.halfCLTaken,
        remaining_cl: calculation.remainingCL,
        excess_cl: merged.excessCL,
        emergency_leave: merged.emergencyLeave,
        bonus: merged.bonus,
        advance_given: merged.advanceGiven,
        previous_pending_advance: calculation.previousPendingAdvance,
        advance_deduction: calculation.advanceDeduction,
        ledger_deduction: calculation.ledgerDeduction,
        actual_ledger_deduction: existing.actual_ledger_deduction ?? calculation.actualLedgerDeduction,
        remaining_ledger_deduction: existing.remaining_ledger_deduction ?? calculation.remainingLedgerDeduction,
        remaining_advance: calculation.remainingAdvance,
        carried_over_advance: 0,
        unrecovered_advance: 0,
        pf_amount: merged.pfAmount,
        absence_deduction: calculation.absenceDeduction,
        excess_cl_deduction: calculation.excessCLDeduction,
        total_deduction: calculation.totalDeduction,
        net_salary: calculation.netSalary,
        per_day_salary: calculation.perDaySalary,
        status: salaryData.status ?? existing.status,
        payment_date: salaryData.status === "Paid"
            ? salaryData.paymentDate || existing.payment_date || new Date().toISOString()
            : salaryData.status === "Pending"
                ? null
                : (salaryData.paymentDate !== undefined ? salaryData.paymentDate : existing.payment_date),
        notes: salaryData.notes !== undefined ? salaryData.notes : (existing.notes || "")
    };

    const { data: updated, error } = await supabase
        .from("salaries")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("*, employees:employee_id(*)")
        .single();

    if (error) {
        return NextResponse.json({ message: "Failed to update salary.", error: error.message }, { status: 500 });
    }

    updated.employee = updated.employees || existing.employee;
    return NextResponse.json({ salary: serializeSalary(updated) });
}

export async function DELETE(request, context) {
    const permission = await requirePermission("salary.delete");
    if (permission.response) return permission.response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const passwordResponse = await requirePassword(String(body?.password || ""));
    if (passwordResponse) return passwordResponse;

    const existing = await findSalaryById(supabase, id);
    if (!existing) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }

    const { error } = await supabase.from("salaries").delete().eq("id", existing.id);
    if (error) {
        return NextResponse.json({ message: "Salary record could not be deleted.", error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}

async function requirePassword(password) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const validUser = await validateCredentials(user.email, password);
    if (!validUser) {
        return NextResponse.json({ message: "Password is incorrect." }, { status: 403 });
    }
    return null;
}
