import { NextResponse } from "next/server";
import {
    checkRateLimit,
    recordFailedAttempt,
    resetAttempts,
    validateDeveloperPassword,
    signDeveloperToken,
    verifyDeveloperToken,
    DEVELOPER_COOKIE,
    getDeveloperCookieOptions
} from "@/lib/developer-auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "global";
    const body = await request.json().catch(() => ({}));
    const { action, password } = body;

    // Check status
    if (action === "check") {
        const isAuth = await verifyDeveloperToken(request);
        return NextResponse.json({ authenticated: isAuth });
    }

    // Lock developer access
    if (action === "lock") {
        const response = NextResponse.json({ success: true, message: "Developer access locked." });
        response.cookies.set(DEVELOPER_COOKIE, "", {
            ...getDeveloperCookieOptions(request),
            maxAge: 0
        });
        return response;
    }

    // Verify developer password
    if (action === "verify") {
        // Brute force protection check
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Too many failed attempts. Access locked for ${rateCheck.remainingSeconds} seconds.`
                },
                { status: 429 }
            );
        }

        const isValid = await validateDeveloperPassword(password);
        if (!isValid) {
            recordFailedAttempt(ip);
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid Developer Access Key. Access Denied."
                },
                { status: 401 }
            );
        }

        // Reset rate limit on success
        resetAttempts(ip);

        // Sign token
        const token = await signDeveloperToken();
        const response = NextResponse.json({
            success: true,
            message: "Developer credentials verified. Access granted."
        });

        // Set HttpOnly secure cookie
        response.cookies.set(DEVELOPER_COOKIE, token, getDeveloperCookieOptions(request));

        return response;
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
}
