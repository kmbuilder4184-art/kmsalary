import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ADMIN_PERMISSIONS, PERMISSIONS, publicUser } from "@/lib/auth";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const userSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    permissions: z.array(z.enum(PERMISSIONS)).default([])
});

export async function GET() {
    const { response } = await requirePermission("admin.manage");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ message: "Failed to fetch users", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: (users || []).map(publicUser) });
}

export async function POST(request) {
    const { response } = await requirePermission("admin.manage");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const parsed = userSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid user details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const filteredPermissions = parsed.data.permissions.filter(
        (permission) => permission !== "admin.manage" && ADMIN_PERMISSIONS.includes(permission)
    );

    const { data: user, error } = await supabase
        .from("users")
        .upsert(
            {
                name: parsed.data.name.trim(),
                email: normalizedEmail,
                password_hash: passwordHash,
                role: "User",
                permissions: filteredPermissions,
                status: "Active"
            },
            { onConflict: "email" }
        )
        .select()
        .single();

    if (error) {
        return NextResponse.json({ message: "Could not create user", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
