import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, getJwtSecret } from "@/lib/session";
const PUBLIC_PATHS = [
    "/login",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/_next",
    "/favicon.ico",
    "/logo.svg"
];
export async function proxy(request) {
    const { pathname } = request.nextUrl;
    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
        try {
            await jwtVerify(token, getJwtSecret());
            return NextResponse.next();
        }
        catch {
            // Fall through to login redirect or API 401 below.
        }
    }
    if (pathname.startsWith("/api")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
}
export const config = {
    matcher: ["/((?!.*\\..*).*)"]
};
