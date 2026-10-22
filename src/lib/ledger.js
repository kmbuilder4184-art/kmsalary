import { getSupabaseAdmin } from "@/lib/supabase";

export async function getEmployeeLedgerBalance(employeeId) {
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
        .from("ledger_entries")
        .select("balance_amount")
        .eq("employee_code", String(employeeId))
        .eq("status", "Open");

    if (error || !rows) {
        return 0;
    }

    const totalBalance = rows.reduce((sum, row) => sum + (Number(row.balance_amount) || 0), 0);
    return round(totalBalance);
}

export async function applyLedgerDeduction(employeeId, amount) {
    let remaining = Math.max(Number(amount) || 0, 0);
    let deducted = 0;
    if (remaining <= 0) return 0;

    const supabase = getSupabaseAdmin();
    const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("employee_code", String(employeeId))
        .eq("status", "Open")
        .gt("balance_amount", 0)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });

    if (error || !entries) return 0;

    for (const entry of entries) {
        if (remaining <= 0) break;
        const currentBalance = Math.max(Number(entry.balance_amount) || 0, 0);
        const cut = Math.min(currentBalance, remaining);
        const newDeducted = round((Number(entry.deducted_amount) || 0) + cut);
        const newBalance = round(currentBalance - cut);
        const isClosed = newBalance <= 0;

        await supabase
            .from("ledger_entries")
            .update({
                deducted_amount: newDeducted,
                balance_amount: isClosed ? 0 : newBalance,
                status: isClosed ? "Closed" : "Open",
                closed_at: isClosed ? new Date().toISOString() : null
            })
            .eq("id", entry.id);

        remaining = round(remaining - cut);
        deducted = round(deducted + cut);
    }

    return deducted;
}

function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
