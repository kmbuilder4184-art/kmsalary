import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/session";
import bcrypt from "bcryptjs";

export const DEVELOPER_COOKIE = "km_developer_session";

export function getDeveloperCookieOptions(request) {
    const isHttps = request?.nextUrl?.protocol === "https:" || request?.headers?.get("x-forwarded-proto") === "https";
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 60 * 60 // 1 hour
    };
}

// In-memory attempt tracking for brute force attack protection
const failedAttempts = new Map();

export function checkRateLimit(ip) {
    const key = ip || "global";
    const record = failedAttempts.get(key);
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.lockUntil && now < record.lockUntil) {
        const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
        return { allowed: false, remainingSeconds };
    }

    if (record.lockUntil && now >= record.lockUntil) {
        failedAttempts.delete(key);
        return { allowed: true };
    }

    return { allowed: true };
}

export function recordFailedAttempt(ip) {
    const key = ip || "global";
    const now = Date.now();
    const record = failedAttempts.get(key) || { count: 0, firstAttempt: now };

    record.count += 1;
    if (record.count >= 5) {
        record.lockUntil = now + 5 * 60 * 1000; // 5 minute cooldown after 5 failed attempts
    }
    failedAttempts.set(key, record);
}

export function resetAttempts(ip) {
    failedAttempts.delete(ip || "global");
}

export async function validateDeveloperPassword(password) {
    if (!password || typeof password !== "string") return false;
    const trimmed = password.trim();

    const expectedHash = process.env.DEVELOPER_PASSWORD_HASH;
    const expectedPlain = process.env.DEVELOPER_PASSWORD || "Akash@Dev8299";

    if (expectedHash) {
        const matches = await bcrypt.compare(trimmed, expectedHash);
        if (matches) return true;
    }

    return trimmed === expectedPlain;
}

export async function signDeveloperToken() {
    return new SignJWT({
        role: "developer",
        scope: "biometric_config_access",
        authorizedAt: new Date().toISOString()
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(getJwtSecret());
}

export async function verifyDeveloperToken(request) {
    const cookieToken = request.cookies.get(DEVELOPER_COOKIE)?.value;
    const headerToken = request.headers.get("x-developer-token");
    const token = cookieToken || headerToken;

    if (!token) return false;

    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        return payload.scope === "biometric_config_access";
    } catch {
        return false;
    }
}
