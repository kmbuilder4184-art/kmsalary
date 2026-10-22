import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await verifySession(token);

    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = getSupabaseAdmin();
        const { data: profile } = await supabase
            .from("settings")
            .select("value")
            .eq("key", `profile:${user.email}`)
            .maybeSingle();

        return NextResponse.json({
            user: { ...user, profilePhoto: profile?.value?.photo || "" }
        });
    } catch {
        return NextResponse.json({ user: { ...user, profilePhoto: "" } });
    }
}
