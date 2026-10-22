import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: sessions, error } = await supabase
        .from("active_sessions")
        .select("*")
        .ilike("email", user.email.toLowerCase())
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("last_seen_at", { ascending: false });

    if (error) {
        return NextResponse.json({ message: "Failed to fetch sessions", error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        sessions: (sessions || []).map((session) => ({
            sessionId: session.session_id,
            current: session.session_id === user.sid,
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            lastSeenAt: session.last_seen_at ? new Date(session.last_seen_at).toISOString() : undefined,
            createdAt: session.created_at ? new Date(session.created_at).toISOString() : undefined,
            expiresAt: session.expires_at ? new Date(session.expires_at).toISOString() : undefined
        }))
    });
}
