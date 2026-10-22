import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await verifySession(token);

    if (user?.sid) {
        try {
            const supabase = getSupabaseAdmin();
            await supabase
                .from("active_sessions")
                .update({ revoked_at: new Date().toISOString() })
                .eq("session_id", user.sid);
        } catch (err) {
            console.error("Logout session revocation error:", err);
        }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
