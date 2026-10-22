import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getJwtSecret, SESSION_COOKIE } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export { getJwtSecret, SESSION_COOKIE };

export const PERMISSIONS = [
    "dashboard.view",
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.delete",
    "salary.view",
    "salary.create",
    "salary.edit",
    "salary.delete",
    "ledger.view",
    "ledger.create",
    "ledger.edit",
    "ledger.delete",
    "reports.view",
    "admin.manage"
];

export const ADMIN_PERMISSIONS = [...PERMISSIONS];

export function getCredentialUsers() {
    const adminEmail = process.env.ADMIN_EMAIL || "Ashish";
    const accountantEmail = process.env.ACCOUNTANT_EMAIL || "accounts@kmbuilders.com";
    const users = [
        {
            email: adminEmail.toLowerCase(),
            name: "Administrator",
            role: "Admin",
            password: process.env.ADMIN_PASSWORD || defaultDevPassword(),
            passwordHash: process.env.ADMIN_PASSWORD_HASH
        },
        {
            email: accountantEmail.toLowerCase(),
            name: "Accounts Office",
            role: "Accountant",
            password: process.env.ACCOUNTANT_PASSWORD || defaultDevPassword(),
            passwordHash: process.env.ACCOUNTANT_PASSWORD_HASH
        }
    ];
    return users.filter((user) => user.email);
}

export async function validateCredentials(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    try {
        const { data: dbUser, error } = await supabase
            .from("users")
            .select("*")
            .ilike("email", normalizedEmail)
            .eq("status", "Active")
            .maybeSingle();

        if (dbUser && !error) {
            const matchesHash = await bcrypt.compare(password, dbUser.password_hash || dbUser.passwordHash);
            if (!matchesHash) return null;
            return publicUser(dbUser);
        }
    } catch (err) {
        console.error("User validation Supabase error:", err);
    }

    const user = getCredentialUsers().find((candidate) => candidate.email === normalizedEmail);
    if (!user) return null;

    if (user.passwordHash) {
        const matchesHash = await bcrypt.compare(password, user.passwordHash);
        if (!matchesHash) return null;
    } else if (user.password !== password) {
        return null;
    }

    return {
        email: user.email,
        name: user.name,
        role: user.role === "Admin" ? "Admin" : "User",
        permissions: user.role === "Admin" ? ADMIN_PERMISSIONS : ["dashboard.view", "employees.view", "salary.view", "ledger.view", "reports.view"],
        sessionVersion: 0
    };
}

export async function signSession(user, request) {
    const sessionId = crypto.randomUUID();
    const sessionVersion = await getSessionVersion(user.email);
    const expiresAt = new Date(Date.now() + 60 * 60 * 8 * 1000).toISOString();
    const supabase = getSupabaseAdmin();

    try {
        await supabase.from("active_sessions").insert({
            session_id: sessionId,
            email: user.email.toLowerCase(),
            user_name: user.name,
            role: user.role,
            session_version: sessionVersion,
            ip_address: request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
            user_agent: request?.headers?.get("user-agent") || "",
            expires_at: expiresAt
        });
    } catch (err) {
        console.error("Error creating active session:", err);
    }

    return new SignJWT({ ...user, sid: sessionId, sessionVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(getJwtSecret());
}

export async function verifySession(token) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        if (
            typeof payload.email !== "string" ||
            typeof payload.name !== "string" ||
            typeof payload.role !== "string"
        ) {
            return null;
        }

        if (typeof payload.sid === "string") {
            const supabase = getSupabaseAdmin();
            const { data: session } = await supabase
                .from("active_sessions")
                .select("*")
                .eq("session_id", payload.sid)
                .is("revoked_at", null)
                .gt("expires_at", new Date().toISOString())
                .maybeSingle();

            if (!session) return null;

            const { data: dbUser } = await supabase
                .from("users")
                .select("session_version, status")
                .ilike("email", payload.email.toLowerCase())
                .maybeSingle();

            if (dbUser) {
                if (dbUser.status === "Inactive") return null;
                if (Number(dbUser.session_version || 0) !== Number(payload.sessionVersion || 0)) {
                    return null;
                }
            }

            const lastSeenAt = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
            if (Date.now() - lastSeenAt > 60 * 1000) {
                await supabase
                    .from("active_sessions")
                    .update({ last_seen_at: new Date().toISOString() })
                    .eq("session_id", payload.sid);
            }
        }

        return {
            email: payload.email,
            name: payload.name,
            role: payload.role,
            permissions: Array.isArray(payload.permissions) ? payload.permissions.filter((item) => typeof item === "string") : [],
            sid: typeof payload.sid === "string" ? payload.sid : undefined,
            sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0
        };
    } catch {
        return null;
    }
}

export function canManageEmployees(role) {
    return role === "Admin";
}

export function hasPermission(user, permission) {
    return user?.role === "Admin" || user?.permissions?.includes(permission);
}

export function publicUser(user) {
    const role = user.role === "Admin" ? "Admin" : "User";
    const permissions = Array.isArray(user.permissions)
        ? user.permissions
        : typeof user.permissions === "string"
        ? JSON.parse(user.permissions || "[]")
        : [];

    return {
        id: String(user.id || user._id || ""),
        _id: String(user.id || user._id || ""),
        email: String(user.email || "").toLowerCase(),
        name: String(user.name || ""),
        role,
        status: user.status === "Inactive" ? "Inactive" : "Active",
        permissions: role === "Admin" ? ADMIN_PERMISSIONS : permissions,
        sessionVersion: Number(user.session_version ?? user.sessionVersion ?? 0)
    };
}

async function getSessionVersion(email) {
    try {
        const supabase = getSupabaseAdmin();
        const { data: dbUser } = await supabase
            .from("users")
            .select("session_version")
            .ilike("email", email.toLowerCase())
            .maybeSingle();

        return Number(dbUser?.session_version || 0);
    } catch {
        return 0;
    }
}

function defaultDevPassword() {
    return undefined;
}
