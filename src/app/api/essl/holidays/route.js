import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
        return NextResponse.json({ holidays: "" });
    }

    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12) {
        return NextResponse.json({ message: "A valid month and year are required." }, { status: 400 });
    }

    const key = `holidays_${year}_${month}`;
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
        if (error) throw error;
        return NextResponse.json({ holidays: data?.value?.dates || "" });
    } catch (error) {
        return NextResponse.json({ message: error.message || "Holiday calendar could not be loaded." }, { status: 500 });
    }
}

export async function POST(request) {
    const body = await request.json().catch(() => null);
    const month = String(body?.month ?? "");
    const year = String(body?.year ?? "");
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12 || typeof body?.holidays !== "string") {
        return NextResponse.json({ message: "Enter a valid month, year, and comma-separated holiday list." }, { status: 400 });
    }

    const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    const tokens = body.holidays.split(/[,;\s]+/).filter(Boolean);
    const invalid = tokens.filter((day) => !/^\d{1,2}$/.test(day) || Number(day) < 1 || Number(day) > lastDay);
    if (invalid.length) {
        return NextResponse.json({ message: `Invalid holiday day(s): ${invalid.join(", ")}. Enter day numbers from 1 to ${lastDay}.` }, { status: 400 });
    }

    const holidays = [...new Set(tokens.map(Number))].sort((a, b) => a - b).join(",");
    const key = `holidays_${year}_${Number(month)}`;
    try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("settings").upsert({ key, value: { dates: holidays } }, { onConflict: "key" });
        if (error) throw error;
        return NextResponse.json({ success: true, holidays });
    } catch (error) {
        return NextResponse.json({ message: "Failed to save holidays to the server.", error: error.message }, { status: 500 });
    }
}
