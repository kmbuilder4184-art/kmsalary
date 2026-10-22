export const SESSION_COOKIE = "sbi_salary_session";
const encoder = new TextEncoder();

export function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET is required in production.");
    }
    return encoder.encode(secret || "development-only-secret-change-before-production");
}

export function getSessionCookieOptions(request) {
    const isHttps = request?.nextUrl?.protocol === "https:" || request?.headers?.get("x-forwarded-proto") === "https";
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/"
    };
}
