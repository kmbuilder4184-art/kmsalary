import { getSchoolInfo } from "@/lib/settings";
import { sendMail } from "@/lib/mailer";
import { formatCurrency, monthName } from "@/lib/utils";

export async function sendSalaryCreatedEmail({ salary, request }) {
    const employee = salary?.employee;
    const to = String(employee?.email || "").trim();
    if (!to) {
        return { sent: false, reason: "Employee email is not available." };
    }
    const school = await getSchoolInfo();
    const monthLabel = `${monthName(salary.month)} ${salary.year}`;
    const slipUrl = getSalarySlipUrl(salary._id, request);
    await sendMail({
        to,
        subject: `Salary Created for ${monthLabel}`,
        text: buildTextEmail({ employee, salary, school, monthLabel, slipUrl }),
        html: buildHtmlEmail({ employee, salary, school, monthLabel, slipUrl })
    });
    return { sent: true, to };
}

function buildTextEmail({ employee, salary, school, monthLabel, slipUrl }) {
    return [
        `Dear ${employee.name},`,
        "",
        `Your salary for ${monthLabel} has been created.`,
        `Net salary amount: ${formatCurrency(salary.netSalary)}.`,
        `This amount will be provided to you by ${school.name} for this month.`,
        slipUrl ? `Salary slip: ${slipUrl}` : "",
        "",
        "Thank you for your continued dedication and hard work.",
        "",
        `Regards,`,
        school.name
    ].filter(Boolean).join("\n");
}

function buildHtmlEmail({ employee, salary, school, monthLabel, slipUrl }) {
    const employeeName = escapeHtml(employee.name || "Employee");
    const schoolName = escapeHtml(school.name || "KM Builders");
    const amount = escapeHtml(formatCurrency(salary.netSalary));
    const safeMonth = escapeHtml(monthLabel);
    const safeSlipUrl = escapeHtml(slipUrl || "#");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Salary Notification</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:'Google Sans', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:30px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1a73e8; padding:24px 32px;">
              <span style="color:#ffffff; font-size:20px; font-weight:600;">Salary Notification / सैलरी सूचना</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:16px; color:#202124; margin:0 0 16px 0;">Dear / प्रिय <strong>${employeeName}</strong>,</p>
              <p style="font-size:15px; color:#3c4043; line-height:1.6; margin:0 0 6px 0;">Your salary for <strong>${safeMonth}</strong> has been created. Please find the details below.</p>
              <p style="font-size:15px; color:#3c4043; line-height:1.6; margin:0 0 20px 0;">आपकी <strong>${safeMonth}</strong> माह की सैलरी क्रिएट कर दी गई है। नीचे विवरण देखें।</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa; border-radius:8px; margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px; font-size:14px; color:#5f6368;">Employee Name<br><span style="font-size:12px; color:#9aa0a6;">कर्मचारी का नाम</span></td>
                  <td style="padding:16px 20px; font-size:14px; color:#202124; text-align:right; font-weight:600;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 16px 20px; font-size:14px; color:#5f6368;">Salary Month<br><span style="font-size:12px; color:#9aa0a6;">सैलरी माह</span></td>
                  <td style="padding:0 20px 16px 20px; font-size:14px; color:#202124; text-align:right; font-weight:600;">${safeMonth}</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 16px 20px; font-size:14px; color:#5f6368;">Amount<br><span style="font-size:12px; color:#9aa0a6;">राशि</span></td>
                  <td style="padding:0 20px 16px 20px; font-size:16px; color:#1a73e8; text-align:right; font-weight:700;">${amount}</td>
                </tr>
              </table>
              <p style="font-size:15px; color:#3c4043; line-height:1.6; margin:0 0 6px 0;">This amount will be provided to you by the company this month.</p>
              <p style="font-size:15px; color:#3c4043; line-height:1.6; margin:0 0 24px 0;">यह राशि इस माह स्कूल की तरफ से आपको प्रदान की जाएगी।</p>
              ${slipUrl ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:6px; background-color:#1a73e8;"><a href="${safeSlipUrl}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; color:#ffffff; text-decoration:none; font-weight:600;">View Salary Slip / स्लिप देखें</a></td></tr></table>` : ""}
              <p style="font-size:14px; color:#5f6368; line-height:1.6; margin:28px 0 0 0;">Thank you for your continued dedication and hard work.<br>आपके निरंतर समर्पण और मेहनत के लिए धन्यवाद।</p>
              <p style="font-size:14px; color:#3c4043; margin:20px 0 0 0;">Regards / सधन्यवाद,<br><strong>${schoolName}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fa; padding:16px 32px; text-align:center;">
              <span style="font-size:12px; color:#9aa0a6;">This is an automated email, please do not reply.<br>यह एक स्वचालित (automated) ईमेल है, कृपया इसका जवाब न दें।</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getSalarySlipUrl(salaryId, request) {
    if (!request?.url || !salaryId)
        return "";
    const url = new URL(`/slips/${salaryId}`, request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedHost)
        url.host = forwardedHost;
    if (forwardedProto)
        url.protocol = `${forwardedProto}:`;
    return url.toString();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
