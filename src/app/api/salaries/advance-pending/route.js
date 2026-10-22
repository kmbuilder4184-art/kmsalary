import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Compute the previous pending advance for a given employee before a specific month/year.
 * Looks at the most recent salary record prior to the given month/year and returns
 * its remaining_advance.
 */
export async function getPreviousPendingAdvance(employeeId, month, year) {
    const supabase = getSupabaseAdmin();

    const { data: previous, error } = await supabase
        .from("salaries")
        .select("remaining_advance, advance_given, advance_deduction, previous_pending_advance, ledger_deduction, carried_over_advance, unrecovered_advance, base_salary, bonus, absence_deduction, excess_cl_deduction, pf_amount, year, month")
        .eq("employee_code", String(employeeId))
        .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1);

    if (error || !previous || previous.length === 0) return 0;
    const last = previous[0];

    if (last.remaining_advance !== null && last.remaining_advance !== undefined) {
        return Number(last.remaining_advance) || 0;
    }

    const totalAdvances = (Number(last.previous_pending_advance) || 0) +
        (Number(last.ledger_deduction) || 0) +
        (Number(last.carried_over_advance) || 0) +
        (Number(last.advance_given) || 0);

    const totalEarnings = (Number(last.base_salary) || 0) + (Number(last.bonus) || 0);
    const otherDeductions = (Number(last.absence_deduction) || 0) +
        (Number(last.excess_cl_deduction) || 0) +
        (Number(last.pf_amount) || 0);

    const available = Math.max(totalEarnings - otherDeductions, 0);
    const actualDeducted = Math.min(Number(last.advance_deduction) || 0, available);
    const unrecovered = Math.max(totalAdvances - actualDeducted, 0);

    if (unrecovered > 0) return unrecovered;

    if (Number(last.unrecovered_advance) > 0) {
        return Number(last.unrecovered_advance);
    }

    return 0;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (!employeeId || !month || !year) {
        return NextResponse.json({ previousPendingAdvance: 0 });
    }

    const pending = await getPreviousPendingAdvance(employeeId, month, year);
    return NextResponse.json({ previousPendingAdvance: pending });
}
