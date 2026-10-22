import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, signSession, validateCredentials } from "@/lib/auth";
import { getCurrentUser } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { getSessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

const passwordSchema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).optional().or(z.literal(""))
});

export async function PATCH(request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Password must be at least 6 characters.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const valid = await validateCredentials(user.email, parsed.data.currentPassword);
    if (!valid) {
        return NextResponse.json({ message: "Current password is incorrect." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = user.email.toLowerCase().trim();

    const { data: existingDbUser } = await supabase
        .from("users")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();

    const passwordHash = parsed.data.newPassword
        ? await bcrypt.hash(parsed.data.newPassword, 10)
        : existingDbUser?.password_hash || (await bcrypt.hash(parsed.data.currentPassword, 10));

    const nextUser = {
        name: parsed.data.name?.trim() || user.name,
        email: (parsed.data.email || user.email).toLowerCase().trim(),
        password_hash: passwordHash,
        role: user.role === "Admin" ? "Admin" : "User",
        permissions: user.permissions || [],
        status: "Active"
    };

    await supabase
        .from("users")
        .upsert(nextUser, { onConflict: "email" });

    const sessionUser = {
        email: nextUser.email,
        name: nextUser.name,
        role: nextUser.role,
        permissions: nextUser.permissions
    };

    await writeAuditLog({
        action: "Password Change",
        actor: sessionUser,
        message: "Account profile/password updated.",
        request
    });

    const token = await signSession(sessionUser, request);
    const response = NextResponse.json({ ok: true, user: sessionUser });
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions(request));
    return response;
}
