"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const shortDate = (value) => {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year.slice(-2)}`;
};

function listDateRange(fromDate, toDate) {
    const start = Date.parse(`${fromDate}T00:00:00Z`);
    const end = Date.parse(`${toDate}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return Array.from({ length: Math.floor((end - start) / 86_400_000) + 1 }, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}

function formatExactPunch(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return "—";
    const hour = Number(match[1]);
    const period = hour >= 12 ? "PM" : "AM";
    return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]}:${match[3] || "00"} ${period}`;
}

function openPunchReport({ students, fromDate, toDate, className, section, attendanceFilter, schoolName }) {
    const reportTab = window.open("", "_blank");
    if (!reportTab) return;

    const isAbsentReport = attendanceFilter === "absent";
    const orderedStudents = [...students].sort((a, b) => String(a.name || "").trim().localeCompare(String(b.name || "").trim(), "en", { sensitivity: "base", numeric: true }));
    const rangeDates = listDateRange(fromDate, toDate);
    const dateChunks = Array.from({ length: Math.ceil(rangeDates.length / 7) }, (_, index) => rangeDates.slice(index * 7, index * 7 + 7));
    const dateTables = dateChunks.map((dateChunk, chunkIndex) => {
        const header = `<thead><tr><th class="serial">S. No.</th><th class="student-name-col">Student Name</th><th class="roll-col">Student / Roll ID</th><th class="class-col">Class &amp; Section</th><th class="machine-col">Machine ID</th>${dateChunk.map((date) => `<th class="date-column">${shortDate(date)}</th>`).join("")}</tr></thead>`;
        const rows = orderedStudents.map((student, index) => {
            const punchByDate = new Map((student.attendance || []).map((day) => [day.date, day.punches || []]));
            const dateCells = dateChunk.map((date) => {
                const firstPunch = [...(punchByDate.get(date) || [])].sort()[0];
                return `<td class="date-value ${firstPunch ? "has-punch" : "no-punch"}">${firstPunch ? escapeHtml(formatExactPunch(firstPunch)) : "—"}</td>`;
            }).join("");
            return `<tr><td class="serial">${String(index + 1).padStart(2, "0")}</td><td class="student-name">${escapeHtml(String(student.name || "").toLocaleUpperCase("en"))}</td><td>${escapeHtml(student.studentCode || "—")}</td><td>${escapeHtml(student.className)}${student.section ? `-${escapeHtml(student.section)}` : ""}</td><td>${escapeHtml(student.esslId || "—")}</td>${dateCells}</tr>`;
        }).join("");
        const continuation = chunkIndex ? " date-continuation" : "";
        const chunkRange = `${shortDate(dateChunk[0])} – ${shortDate(dateChunk[dateChunk.length - 1])}`;
        const chunkHeading = rangeDates.length === 1 ? "" : `<h3 class="date-page-title">Punch dates: ${escapeHtml(chunkRange)}${rangeDates.length > 7 ? ` · Part ${chunkIndex + 1} of ${dateChunks.length}` : ""}</h3>`;
        const singleDate = rangeDates.length === 1 ? " single-date-table" : "";
        return `<section class="date-page${continuation}">${chunkHeading}<table class="report-table${singleDate}">${header}<tbody>${rows}</tbody></table></section>`;
    }).join("");
    const pageOrientation = rangeDates.length > 3 ? "landscape" : "portrait";
    const safeSchoolName = escapeHtml(schoolName);
    const dateLabel = escapeHtml(`${shortDate(fromDate)} – ${shortDate(toDate)}`);
    const classLabel = escapeHtml(className === "All" ? "All Classes" : className);
    const sectionLabel = escapeHtml(section === "All" ? "All Sections" : `Section ${section}`);
    const reportTitle = isAbsentReport ? "Absent Student Report" : "Student Punch Report";
    const attendanceLabel = isAbsentReport ? "Absent" : attendanceFilter === "all" ? "All students" : "Present";
    const instructions = "Students are listed alphabetically. Each date column shows the first biometric punch only, with seconds and AM/PM in Indian Standard Time. A dash means no punch was recorded on that date.";

    reportTab.opener = null;
    reportTab.document.open();
    reportTab.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(reportTitle)} · ${safeSchoolName}</title>
<style>
*{box-sizing:border-box}html{background:#edf1f6;color:#172033;font-family:Arial,Helvetica,sans-serif}body{margin:0}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:center;align-items:center;gap:12px;padding:12px;background:#173b73;color:#fff;box-shadow:0 3px 12px #0f172a22}.toolbar span{font-size:14px}.toolbar button{border:0;border-radius:8px;padding:9px 18px;background:#fff;color:#173b73;font-size:14px;font-weight:700;cursor:pointer}.sheet{width:210mm;min-height:297mm;margin:18px auto;padding:10mm;background:#fff;box-shadow:0 5px 24px #0f172a30}.report-header{display:grid;grid-template-columns:22mm 1fr 22mm;align-items:center;gap:4mm;padding-bottom:3mm;border-bottom:2px solid #173b73}.report-header img{width:20mm;height:20mm;object-fit:contain}.school{text-align:center}.kicker,.eyebrow{margin:0 0 1.5mm;color:#13836b;font-size:7pt;font-weight:700;letter-spacing:1.3px}.school h1{margin:0;color:#173b73;font-family:Georgia,'Times New Roman',serif;font-size:17pt;line-height:1.15}.school p{margin:1mm 0 0;color:#53627a;font-size:8pt}.school .motto{color:#13836b;font-family:Georgia,'Times New Roman',serif;font-size:10pt;font-style:italic;font-weight:700}.mark{justify-self:end;border:1px solid #cbd5e1;border-radius:2mm;padding:2mm;color:#64748b;font-size:6pt;font-weight:700;line-height:1.5;text-align:center}.title-row{display:flex;justify-content:space-between;align-items:end;margin:3mm 0 2mm}.title-row h2{margin:0;color:#172033;font-size:15pt}.date{text-align:right}.date span,.meta span{display:block;margin-bottom:1mm;color:#64748b;font-size:6.5pt;font-weight:700;letter-spacing:.7px}.date strong{color:#173b73;font-size:9pt}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;padding:2mm 2.5mm;border:1px solid #dbe4ef;border-radius:2mm;background:#f5f8fc}.meta strong{font-size:8pt}.instruction{margin:2mm 0;color:#526176;font-size:7pt;line-height:1.3}.date-page-title{margin:2mm 0 1mm;color:#173b73;font-size:8pt;font-weight:700}.report-table{width:100%;border-collapse:collapse;table-layout:fixed}.report-table th{padding:1.4mm 1mm;border:1px solid #cbd5e1;background:#173b73;color:#fff;font-size:7pt;text-align:left}.report-table td{padding:1.1mm 1mm;border:1px solid #d7e0eb;color:#273449;font-size:7pt;line-height:1.35;overflow-wrap:anywhere;vertical-align:top}.report-table tbody tr:nth-child(even){background:#f4f8fc}.report-table .serial{width:9mm;text-align:center;color:#526176}.report-table .student-name-col{width:42mm}.report-table .roll-col{width:21mm}.report-table .class-col{width:24mm}.report-table .machine-col{width:21mm}.report-table th.date-column,.report-table td.date-value{text-align:center;white-space:normal}.report-table td.date-value{font-size:6.5pt;overflow-wrap:anywhere}.report-table td.has-punch{color:#087a5b;font-weight:700}.report-table td.no-punch{color:#a2adbd}.student-name{font-weight:700}.absent-status{color:#b4233c!important;font-size:7pt!important;font-weight:700}.date-continuation{break-before:page;page-break-before:always}.footer{margin-top:3mm;color:#64748b;font-size:7pt}.signatures{display:flex;justify-content:space-between;gap:10mm;margin:10mm 4mm 3mm}.signatures span{min-width:35mm;padding-top:2mm;border-top:1px solid #64748b;color:#334155;text-align:center}.footer small{display:block;padding-top:2mm;border-top:1px solid #e2e8f0;color:#94a3b8;text-align:center}.footer .credit{display:block;margin-top:1.5mm;color:#173b73;font-size:7.5pt;font-weight:700;letter-spacing:.2px;text-align:center}
@page{size:A4 ${pageOrientation};margin:9mm 10mm}@media print{html,body{display:block!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important;float:none!important;position:static!important;transform:none!important}.toolbar{display:none!important}.sheet{display:block!important;position:static!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important;box-shadow:none!important;break-before:auto!important;page-break-before:auto!important;break-after:auto!important;page-break-after:auto!important;break-inside:auto!important;page-break-inside:auto!important}.report-header,.title-row,.meta,.instruction{break-inside:auto!important;page-break-inside:auto!important}.report-table{display:table!important;width:100%!important;break-inside:auto!important;page-break-inside:auto!important}.report-table thead{display:table-header-group}.report-table tr,.report-header img{break-inside:avoid;page-break-inside:avoid}.report-table th,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
@media print{.report-table.single-date-table .serial{width:9mm}.report-table.single-date-table .student-name-col{width:55mm}.report-table.single-date-table .roll-col{width:25mm}.report-table.single-date-table .class-col{width:31mm}.report-table.single-date-table .machine-col{width:25mm}.report-table.single-date-table .date-column,.report-table.single-date-table .date-value{width:45mm}.report-table.single-date-table th.date-column{font-size:8pt;text-align:center}.report-table.single-date-table td.date-value{font-size:9pt;font-weight:700;white-space:nowrap;padding:2mm 1mm}.report-table.single-date-table tbody tr{height:9mm}}
@media print{.report-table{width:100%!important;border:0.45mm solid #8093ad!important;border-collapse:collapse!important}.report-table th{padding:2mm 1.6mm!important;border:0.35mm solid #8093ad!important;background:#173b73!important;font-size:8pt!important;line-height:1.2!important;letter-spacing:.1px}.report-table td{padding:1.8mm 1.6mm!important;border:0.3mm solid #9aabc0!important;color:#1f2d42!important;font-size:8pt!important;line-height:1.3!important;vertical-align:middle!important}.report-table tbody tr:nth-child(even){background:#edf3f9!important}.report-table .serial{font-size:8pt!important;color:#42536b!important}.report-table .student-name{font-size:8.4pt!important;font-weight:700!important}.report-table td.has-punch{color:#087a5b!important;font-size:9pt!important;font-weight:700!important}.report-table.single-date-table td.date-value{padding:2.1mm 1mm!important;font-size:10pt!important}.report-table.single-date-table th.date-column{font-size:9pt!important}.report-table.single-date-table tbody tr{height:10mm}.report-table th,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
@media screen and (max-width:800px){.sheet{width:100%;min-height:0;margin:0;padding:20px;overflow-x:auto}.report-table{min-width:680px}.report-header{grid-template-columns:54px 1fr 45px}.report-header img{width:50px;height:50px}.school h1{font-size:16px}.toolbar{position:static}}
</style></head><body>
<nav class="toolbar"><span>Report ready · use Ctrl+P or ⌘P to print on A4</span><button type="button" onclick="window.print()">Print report</button></nav>
<main class="sheet"><header class="report-header"><img src="/km-builders-logo.png" alt="KM Builders logo"><div class="school"><p class="kicker">EMPLOYEE BIOMETRIC ATTENDANCE</p><h1>${safeSchoolName}</h1><p>Property Developers</p><p class="motto">From Vision to Reality</p></div><div class="mark">OFFICIAL<br>COMPANY<br>RECORD</div></header>
<div class="title-row"><div><p class="eyebrow">BIOMETRIC ATTENDANCE REGISTER</p><h2>${escapeHtml(reportTitle)}</h2></div><div class="date"><span>DATE RANGE</span><strong>${dateLabel}</strong></div></div>
<div class="meta"><div><span>CLASS</span><strong>${classLabel}</strong></div><div><span>SECTION</span><strong>${sectionLabel}</strong></div><div><span>ATTENDANCE FILTER</span><strong>${escapeHtml(attendanceLabel)}</strong></div><div><span>STUDENTS</span><strong>${orderedStudents.length}</strong></div></div>
<p class="instruction">${escapeHtml(instructions)}</p>
${dateTables}
<footer class="footer"><p>Generated from the biometric attendance system · ${orderedStudents.length} employee record${orderedStudents.length === 1 ? "" : "s"}</p><div class="signatures"><span>Site Supervisor</span><span>Attendance In-charge</span><span>Manager</span></div><small>Computer-generated attendance report · For official company use</small><strong class="credit">Designed &amp; Developed by AKASH · Software Engineer</strong></footer></main>
</body></html>`);
    reportTab.document.close();
}

export function StudentPunchReport({ students, fromDate, toDate, className, section, attendanceFilter, schoolName = "KM Builders" }) {
    return <Button type="button" variant="secondary" onClick={() => openPunchReport({ students, fromDate, toDate, className, section, attendanceFilter, schoolName })} disabled={!students.length}>
        <Printer className="h-4 w-4" />Print Punch Report
    </Button>;
}
