import nodemailer from "nodemailer";
import { getSmtpSettings } from "@/lib/settings";

export async function sendMail({ to, subject, text, html }) {
    const settings = await getSmtpSettings({ includePassword: true });
    if (!settings.configured || !settings.password) {
        throw new Error("SMTP settings are not configured.");
    }
    const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: Number(settings.port) === 465,
        auth: {
            user: settings.email,
            pass: settings.password
        }
    });
    return transporter.sendMail({
        from: `"${settings.fromName}" <${settings.email}>`,
        to,
        subject,
        text,
        html
    });
}
