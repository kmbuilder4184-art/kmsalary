import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = user.email.toLowerCase();

    const { data: dbUser } = await supabase
        .from("users")
        .select("session_version")
        .ilike("email", normalizedEmail)
        .maybeSingle();

    await Promise.all([
        supabase
            .from("active_sessions")
            .update({ revoked_at: new Date().toISOString() })
            .ilike("email", normalizedEmail)
            .is("revoked_at", null),
        supabase
            .from("users")
            .update({ session_version: (dbUser?.session_version || 0) + 1 })
            .ilike("email", normalizedEmail)
    ]);

    await writeAuditLog({
        action: "Logout All Devices",
        actor: user,
        message: "All active sessions revoked.",
        request
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
