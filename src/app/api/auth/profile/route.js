import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const photo = typeof body?.photo === "string" ? body.photo : "";
    if (photo && (!photo.startsWith("data:image/") || photo.length > 2500000)) {
        return NextResponse.json({ message: "Please upload a valid image under 2 MB." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const profileKey = `profile:${user.email}`;

    const { data: profile, error } = await supabase
        .from("settings")
        .upsert({ key: profileKey, value: { photo } }, { onConflict: "key" })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ message: "Could not update profile photo." }, { status: 500 });
    }

    return NextResponse.json({ profile: profile.value });
}
