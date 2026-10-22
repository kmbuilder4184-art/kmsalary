import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasPermission, SESSION_COOKIE, verifySession } from "@/lib/auth";
export async function getCurrentUser() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return verifySession(token);
}
export async function requireRole(roles) {
    const user = await getCurrentUser();
    if (!user) {
        return {
            user: null,
            response: NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        };
    }
    if (!roles.includes(user.role)) {
        return {
            user,
            response: NextResponse.json({ message: "Forbidden" }, { status: 403 })
        };
    }
    return { user, response: null };
}
export async function requirePermission(permission) {
    const user = await getCurrentUser();
    if (!user) {
        return {
            user: null,
            response: NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        };
    }
    if (!hasPermission(user, permission)) {
        return {
            user,
            response: NextResponse.json({ message: "Permission denied." }, { status: 403 })
        };
    }
    return { user, response: null };
}
