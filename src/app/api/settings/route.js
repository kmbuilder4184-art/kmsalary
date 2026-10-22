import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSchoolInfo, getSmtpSettings, saveSchoolInfo, saveSmtpSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
    schoolInfo: z.object({
        name: z.string().min(2),
        address: z.string().min(2),
        phone: z.string().optional().or(z.literal("")),
        email: z.string().email().optional().or(z.literal("")),
        website: z.string().url().optional().or(z.literal(""))
    }).optional(),
    smtpSettings: z.object({
        host: z.string().min(2),
        port: z.coerce.number().int().min(1).max(65535),
        email: z.string().email(),
        password: z.string().optional().or(z.literal("")),
        fromName: z.string().min(2)
    }).optional()
});

export async function GET() {
    const { response } = await requirePermission("admin.manage");
    if (response) return response;

    const supabase = getSupabaseAdmin();

    const [schoolInfo, smtpSettings, auditLogsResult, systemInfo] = await Promise.all([
        getSchoolInfo(),
        getSmtpSettings(),
        supabase
            .from("audit_logs")
            .select("*")
            .in("action", ["Login", "Password Change", "Backup", "Restore"])
            .order("created_at", { ascending: false })
            .limit(50),
        getSystemInfo(supabase)
    ]);

    const auditLogs = (auditLogsResult.data || []).map((log) => ({
        _id: String(log.id),
        id: String(log.id),
        action: log.action,
        actorEmail: log.actor_email,
        actorName: log.actor_name,
        status: log.status,
        message: log.message,
        createdAt: log.created_at
    }));

    return NextResponse.json({
        schoolInfo,
        smtpSettings,
        auditLogs,
        systemInfo
    });
}

export async function PATCH(request) {
    const { response } = await requirePermission("admin.manage");
    if (response) return response;

    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid settings.", errors: parsed.error.flatten() }, { status: 400 });
    }

    const result = {};
    if (parsed.data.schoolInfo) {
        result.schoolInfo = await saveSchoolInfo(parsed.data.schoolInfo);
    }
    if (parsed.data.smtpSettings) {
        result.smtpSettings = await saveSmtpSettings(parsed.data.smtpSettings);
    }
    return NextResponse.json(result);
}

async function getSystemInfo(supabase) {
    let dbStatus = "Disconnected";
    let counts = {};

    try {
        const [{ count: empCount }, { count: salCount }, { count: ledgerCount }] = await Promise.all([
            supabase.from("employees").select("*", { count: "exact", head: true }),
            supabase.from("salaries").select("*", { count: "exact", head: true }),
            supabase.from("ledger_entries").select("*", { count: "exact", head: true })
        ]);

        dbStatus = "Connected (Supabase PostgreSQL)";
        counts = {
            employees: empCount || 0,
            salaries: salCount || 0,
            ledgerEntries: ledgerCount || 0
        };
    } catch {
        dbStatus = "Unavailable";
    }

    return {
        appVersion: process.env.npm_package_version || "1.0.0",
        databaseType: "Supabase PostgreSQL",
        mongoStatus: dbStatus,
        databaseName: "Supabase PostgreSQL Database",
        storageUsage: counts,
        nodeVersion: process.version
    };
}
