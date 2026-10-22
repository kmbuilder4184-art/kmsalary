import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ADMIN_PERMISSIONS, PERMISSIONS, publicUser } from "@/lib/auth";
import { getCurrentUser, requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
    name: z.string().min(2).optional(),
    password: z.string().min(6).optional().or(z.literal("")),
    permissions: z.array(z.enum(PERMISSIONS)).optional(),
    status: z.enum(["Active", "Inactive"]).optional()
});

export async function PATCH(request, context) {
    const { response } = await requirePermission("admin.manage");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const { email } = await context.params;
    const targetEmail = decodeURIComponent(email).toLowerCase().trim();

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { message: "Invalid user details.", errors: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const updatePayload = {};
    if (parsed.data.name) updatePayload.name = parsed.data.name.trim();
    if (parsed.data.status) updatePayload.status = parsed.data.status;
    if (parsed.data.password) {
        updatePayload.password_hash = await bcrypt.hash(parsed.data.password, 10);
    }
    if (parsed.data.permissions) {
        updatePayload.permissions = parsed.data.permissions.filter(
            (permission) => permission !== "admin.manage" && ADMIN_PERMISSIONS.includes(permission)
        );
    }

    const { data: user, error } = await supabase
        .from("users")
        .update(updatePayload)
        .ilike("email", targetEmail)
        .neq("role", "Admin")
        .select()
        .single();

    if (error || !user) {
        return NextResponse.json({ message: "User not found or cannot be modified." }, { status: 404 });
    }

    return NextResponse.json({ user: publicUser(user) });
}

export async function DELETE(_, context) {
    const { response } = await requirePermission("admin.manage");
    if (response) return response;

    const supabase = getSupabaseAdmin();
    const current = await getCurrentUser();
    const { email } = await context.params;
    const targetEmail = decodeURIComponent(email).toLowerCase().trim();

    if (current?.email === targetEmail) {
        return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
    }

    const { data: user, error } = await supabase
        .from("users")
        .update({ status: "Inactive" })
        .ilike("email", targetEmail)
        .neq("role", "Admin")
        .select()
        .single();

    if (error || !user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user: publicUser(user) });
}
