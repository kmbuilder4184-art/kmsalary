import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCredentialUsers } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
    email: z.string().email()
});

export async function POST(request) {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const supabase = getSupabaseAdmin();

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
        .from("password_reset_otps")
        .select("*", { count: "exact", head: true })
        .ilike("email", email)
        .eq("request_ip", ipAddress)
        .gte("created_at", since);

    if ((count || 0) >= 3) {
        return NextResponse.json({ message: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
    }

    const { data: dbUser } = await supabase
        .from("users")
        .select("email")
        .ilike("email", email)
        .eq("status", "Active")
        .maybeSingle();

    const fallbackUser = getCredentialUsers().find((candidate) => candidate.email === email);
    if (!dbUser && !fallbackUser) {
        return NextResponse.json({ ok: true });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);

    await supabase
        .from("password_reset_otps")
        .update({ used_at: new Date().toISOString() })
        .ilike("email", email)
        .is("used_at", null);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from("password_reset_otps").insert({
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        request_ip: ipAddress
    });

    try {
        await sendMail({
            to: email,
            subject: "Password reset OTP",
            text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your password reset OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
        });
    } catch (error) {
        return NextResponse.json({ message: error.message || "Unable to send OTP email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
