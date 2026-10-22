import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEmployeeLedgerBalance } from "@/lib/ledger";
import { serializeLedgerEntry } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const ledgerSchema = z.object({
    employee: z.string().min(1),
    amount: z.coerce.number().min(1),
    entryDate: z.string().min(1),
    notes: z.string().optional()
});

export async function GET(request) {
    const { response } = await requirePermission("ledger.view");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

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
        `)
        .order("status", { ascending: true })
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (employeeId) {
        query = query.eq("employee_code", employeeId);
    }
    if (status === "Open" || status === "Closed") {
        query = query.eq("status", status);
    }

    const { data: entries, error } = await query;

    if (error) {
        console.error("Supabase ledger fetch error:", error);
        return NextResponse.json({ message: "Failed to fetch ledger entries", error: error.message }, { status: 500 });
    }

    const formatted = (entries || []).map((entry) => ({
        ...entry,
        employee: entry.employees
    }));

    const balance = employeeId ? await getEmployeeLedgerBalance(employeeId) : undefined;

    return NextResponse.json({
        entries: formatted.map(serializeLedgerEntry),
        balance
    });
}

export async function POST(request) {
    const { response } = await requirePermission("ledger.create");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const parsed = ledgerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid expense details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.data.employee);
    let empQuery = supabase.from("employees").select("*");
    if (isUuid) {
        empQuery = empQuery.eq("id", parsed.data.employee);
    } else {
        empQuery = empQuery.or(`id.eq.${parsed.data.employee},employee_id.eq.${parsed.data.employee}`);
    }

    const { data: employee } = await empQuery.maybeSingle();

    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }

    const { data: entry, error } = await supabase
        .from("ledger_entries")
        .insert({
            employee_id: employee.id,
            employee_code: String(employee.employee_id),
            amount: parsed.data.amount,
            deducted_amount: 0,
            balance_amount: parsed.data.amount,
            entry_date: parsed.data.entryDate,
            notes: parsed.data.notes || "",
            status: "Open"
        })
        .select("*, employees:employee_id(*)")
        .single();

    if (error) {
        console.error("Supabase ledger insert error:", error);
        return NextResponse.json({ message: "Failed to save ledger entry", error: error.message }, { status: 500 });
    }

    entry.employee = entry.employees || employee;
    return NextResponse.json({ entry: serializeLedgerEntry(entry) }, { status: 201 });
}
