import { NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
    const { user, response } = await requirePermission("admin.manage");
    if (response) return response;

    const supabase = getSupabaseAdmin();

    const [
        { data: users },
        { data: employees },
        { data: salaries },
        { data: ledgerEntries },
        { data: settings },
        { data: auditLogs }
    ] = await Promise.all([
        supabase.from("users").select("*"),
        supabase.from("employees").select("*"),
        supabase.from("salaries").select("*"),
        supabase.from("ledger_entries").select("*"),
        supabase.from("settings").select("*"),
        supabase.from("audit_logs").select("*").limit(1000)
    ]);

    const backup = {
        format: "salary-management-backup",
        version: 3,
        databaseType: "supabase-postgresql",
        createdAt: new Date().toISOString(),
        tables: {
            users: users || [],
            employees: employees || [],
            salaries: salaries || [],
            ledger_entries: ledgerEntries || [],
            settings: settings || [],
            audit_logs: auditLogs || []
        }
    };

    const json = JSON.stringify(backup, null, 2);
    const body = gzipSync(Buffer.from(json));

    await writeAuditLog({
        action: "Backup",
        actor: user,
        message: "Complete Supabase database backup downloaded.",
        metadata: {
            tables: Object.keys(backup.tables),
            totalRecords: Object.values(backup.tables).reduce((c, rows) => c + rows.length, 0),
            jsonBytes: Buffer.byteLength(json),
            compressedBytes: body.byteLength
        },
        request
    });

    return new NextResponse(body, {
        headers: {
            "Content-Type": "application/gzip",
            "Content-Disposition": `attachment; filename="salary-supabase-backup-${new Date().toISOString().slice(0, 10)}.json.gz"`,
            "Cache-Control": "no-store"
        }
    });
}
