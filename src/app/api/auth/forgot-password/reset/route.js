import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_PERMISSIONS, getCredentialUsers } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
    email: z.string().email(),
    resetToken: z.string().min(32),
    password: z.string().min(6)
});

export async function POST(request) {
    const parsed = resetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Password must be at least 6 characters." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const supabase = getSupabaseAdmin();

    const { data: record } = await supabase
        .from("password_reset_otps")
        .select("*")
        .ilike("email", email)
        .is("used_at", null)
        .not("verified_at", "is", null)
        .gt("expires_at", new Date().toISOString())
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!record?.reset_token_hash) {
        return NextResponse.json({ message: "Reset session is invalid or expired." }, { status: 400 });
    }

    const tokenOk = await bcrypt.compare(parsed.data.resetToken, record.reset_token_hash);
    if (!tokenOk) {
        return NextResponse.json({ message: "Reset session is invalid or expired." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .ilike("email", email)
        .maybeSingle();

    let user;
    if (existingUser) {
        const { data: updated } = await supabase
            .from("users")
            .update({
                password_hash: passwordHash,
                session_version: (existingUser.session_version || 0) + 1
            })
            .eq("id", existingUser.id)
            .select()
            .single();
        user = updated;
    } else {
        const fallbackUser = getCredentialUsers().find((candidate) => candidate.email === email);
        if (!fallbackUser) {
            return NextResponse.json({ message: "User not found." }, { status: 404 });
        }

        const { data: created } = await supabase
            .from("users")
            .insert({
                name: fallbackUser.name,
                email,
                password_hash: passwordHash,
                role: fallbackUser.role === "Admin" ? "Admin" : "User",
                permissions: fallbackUser.role === "Admin" ? ADMIN_PERMISSIONS : ["dashboard.view", "employees.view", "salary.view", "reports.view"],
                status: "Active",
                session_version: 1
            })
            .select()
            .single();
        user = created;
    }

    await supabase
        .from("password_reset_otps")
        .update({ used_at: new Date().toISOString() })
        .eq("id", record.id);

    await writeAuditLog({
        action: "Password Change",
        actor: { email: user.email, name: user.name },
        message: "Password reset with OTP.",
        request
    });

    return NextResponse.json({ ok: true });
}
