import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
const SETTING_KEY = "attendance_late_arrival_policy";
const schema = z.object({ lateArrivalBoundary: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

export async function GET() {
    const { response } = await requirePermission("dashboard.view");
    if (response) return response;
    const { data, error } = await getSupabaseAdmin().from("settings").select("value").eq("key", SETTING_KEY).maybeSingle();
    if (error) return NextResponse.json({ message: "Could not load attendance policy." }, { status: 500 });
    return NextResponse.json({ lateArrivalBoundary: data?.value?.lateArrivalBoundary || "07:30" });
}

export async function PATCH(request) {
    const { response } = await requirePermission("dashboard.view");
    if (response) return response;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Enter a valid late-arrival time." }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("settings").upsert({ key: SETTING_KEY, value: parsed.data }, { onConflict: "key" });
    if (error) return NextResponse.json({ message: "Could not save attendance policy." }, { status: 500 });
    return NextResponse.json({ success: true, ...parsed.data });
}
