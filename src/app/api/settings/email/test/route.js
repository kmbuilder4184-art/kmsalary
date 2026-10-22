import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const testSchema = z.object({
    to: z.string().email()
});

export async function POST(request) {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = testSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Enter a valid test email." }, { status: 400 });
    }
    try {
        await sendMail({
            to: parsed.data.to,
            subject: "Salary Management SMTP Test",
            text: "SMTP email settings are working.",
            html: "<p>SMTP email settings are working.</p>"
        });
        return NextResponse.json({ ok: true });
    }
    catch (error) {
        return NextResponse.json({ message: error.message || "Test email failed." }, { status: 500 });
    }
}
