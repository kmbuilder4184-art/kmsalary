import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/)
});

export async function POST(request) {
    const parsed = verifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Enter the 6 digit OTP." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const supabase = getSupabaseAdmin();

    const { data: record } = await supabase
        .from("password_reset_otps")
        .select("*")
        .ilike("email", email)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!record || (record.attempts || 0) >= 5) {
        return NextResponse.json({ message: "OTP is invalid or expired." }, { status: 400 });
    }

    const ok = await bcrypt.compare(parsed.data.otp, record.otp_hash);
    if (!ok) {
        await supabase
            .from("password_reset_otps")
            .update({ attempts: (record.attempts || 0) + 1 })
            .eq("id", record.id);

        return NextResponse.json({ message: "OTP is invalid or expired." }, { status: 400 });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = await bcrypt.hash(resetToken, 10);

    await supabase
        .from("password_reset_otps")
        .update({
            verified_at: new Date().toISOString(),
            reset_token_hash: resetTokenHash
        })
        .eq("id", record.id);

    return NextResponse.json({ resetToken });
}
