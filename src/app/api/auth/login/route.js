import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession, validateCredentials } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getSessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request) {
    const body = await request.json().catch(() => null);
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    let user;
    try {
        user = await validateCredentials(email, password);
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({
            message: "Database unavailable. Please verify Supabase configuration in .env.local."
        }, { status: 503 });
    }

    if (!user) {
        await writeAuditLog({
            action: "Login",
            status: "Failed",
            message: "Invalid email or password.",
            actor: { email },
            request
        }).catch(() => null);

        return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const token = await signSession(user, request);
    await writeAuditLog({ action: "Login", actor: user, message: "User signed in.", request }).catch(() => null);

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions(request));
    return response;
}
