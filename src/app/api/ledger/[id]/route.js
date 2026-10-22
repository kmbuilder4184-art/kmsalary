import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serializeLedgerEntry } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

async function findLedgerById(supabase, id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabase
        .from("ledger_entries")
        .select(`
            *,
            employees:employee_id (
                id,
                employee_id,
                name,
                role,
                department,
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

export async function PATCH(request, context) {
    const { response } = await requirePermission("ledger.edit");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const entry = await findLedgerById(supabase, id);

    if (!entry) {
        return NextResponse.json({ message: "Expense entry not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    let deductedAmount = Number(entry.deducted_amount || 0);
    let balanceAmount = Number(entry.balance_amount || 0);
    let status = entry.status;
    let closedAt = entry.closed_at;

    if (body?.status === "Closed") {
        deductedAmount = Number(entry.amount || 0);
        balanceAmount = 0;
        status = "Closed";
        closedAt = new Date().toISOString();
    } else if (body?.status === "Open") {
        balanceAmount = Math.max(Number(entry.amount || 0) - deductedAmount, 0);
        status = balanceAmount > 0 ? "Open" : "Closed";
        closedAt = status === "Closed" ? closedAt || new Date().toISOString() : null;
    } else {
        return NextResponse.json({ message: "Invalid expense update." }, { status: 400 });
    }

    const { data: updated, error } = await supabase
        .from("ledger_entries")
        .update({
            deducted_amount: deductedAmount,
            balance_amount: balanceAmount,
            status,
            closed_at: closedAt
        })
        .eq("id", entry.id)
        .select("*, employees:employee_id(*)")
        .single();

    if (error) {
        return NextResponse.json({ message: "Failed to update ledger entry", error: error.message }, { status: 500 });
    }

    updated.employee = updated.employees || entry.employee;
    return NextResponse.json({ entry: serializeLedgerEntry(updated) });
}

export async function DELETE(_, context) {
    const { response } = await requirePermission("ledger.delete");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { id } = await context.params;
    const entry = await findLedgerById(supabase, id);

    if (!entry) {
        return NextResponse.json({ message: "Expense entry not found." }, { status: 404 });
    }

    await supabase.from("ledger_entries").delete().eq("id", entry.id);
    return NextResponse.json({ ok: true });
}
