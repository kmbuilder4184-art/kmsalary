"use client";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function datesByMonthAndChunk(dates, chunkSize) {
    const byMonth = new Map();
    for (const date of dates) {
        const key = date.slice(0, 7);
        byMonth.set(key, [...(byMonth.get(key) || []), date]);
    }
    return [...byMonth.entries()].flatMap(([month, monthDates]) => Array.from({ length: Math.ceil(monthDates.length / chunkSize) }, (_, index) => ({ month, dates: monthDates.slice(index * chunkSize, (index + 1) * chunkSize) })));
}

function formatDisplayDate(date, options) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-IN", { ...(options || { day: "2-digit", month: "short", year: "numeric" }), timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

function formatPunch(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return "—";
    const hour = Number(match[1]);
    return String(hour % 12 || 12) + ":" + match[2] + " " + (hour >= 12 ? "PM" : "AM");
}

function firstPunch(student, date) {
    const day = (student.attendance || []).find((item) => item.date === date);
    return [...(day?.punches || [])].sort()[0] || "";
}

function isWorkingDay(date, holidays) {
    return new Date(date + "T12:00:00Z").getUTCDay() !== 0 && !holidays.has(date);
}

function statusFor(student) {
    return student.selectedPresent > 0 ? "Present" : "Absent";
}

function summaryRows(students, sessionWorkingDays) {
    return students.map((student, index) => {
        const name = String(student.name || "").toLocaleUpperCase("en");
        const id = student.studentCode || student.esslId || "—";
        const classSection = (student.className || "—") + (student.section ? "-" + student.section : "");
        const status = statusFor(student);
        return "<tr><td class=\"serial\">" + (index + 1) + "</td><td>" + escapeHtml(id) + "</td><td class=\"student-name\">" + escapeHtml(name) + "</td><td>" + escapeHtml(classSection) + "</td><td class=\"status " + (status === "Present" ? "present" : "absent") + "\">" + status + "</td><td class=\"number present-number\">" + student.currentMonthPresent + "</td><td class=\"number\">" + student.previousMonthPresent + "</td><td class=\"number present-number\">" + student.sessionPresent + " / " + sessionWorkingDays + "</td></tr>";
    }).join("");
}

function dailyRows(students, dates, holidays) {
    return students.map((student, index) => {
        const name = String(student.name || "").toLocaleUpperCase("en");
        const id = student.studentCode || student.esslId || "—";
        const classSection = (student.className || "—") + (student.section ? "-" + student.section : "");
        const status = statusFor(student);
        const cells = dates.map((date) => {
            const punch = firstPunch(student, date);
            const label = punch ? formatPunch(punch) : isWorkingDay(date, holidays) ? "A" : "—";
            const cellClass = punch ? "punch" : label === "A" ? "absent" : "closed";
            return "<td class=\"day-cell " + cellClass + "\">" + escapeHtml(label) + "</td>";
        }).join("");
        return "<tr><td class=\"serial\">" + (index + 1) + "</td><td>" + escapeHtml(id) + "</td><td class=\"student-name\">" + escapeHtml(name) + "</td><td>" + escapeHtml(classSection) + "</td><td class=\"status " + (status === "Present" ? "present" : "absent") + "\">" + status + "</td>" + cells + "</tr>";
    }).join("");
}

function schoolHeader(schoolName) {
    return "<header class=\"school-header\"><img src=\"/km-builders-logo.png\" alt=\"KM Builders logo\"><div class=\"school-heading\"><p class=\"kicker\">EMPLOYEE BIOMETRIC ATTENDANCE</p><h1>" + escapeHtml(schoolName) + "</h1><p>Property Developers</p><p class=\"motto\">From Vision to Reality</p></div><div class=\"official-mark\">OFFICIAL<br>COMPANY<br>RECORD</div></header>";
}

export function openAttendanceRegister({ students, dates, dateFrom, dateTo, sessionStartDate, attendanceFilter, className, section, schoolName, summary, holidays }) {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
        window.alert("Allow pop-ups to open the Attendance Register in a new tab.");
        return;
    }
    const orderedStudents = [...students].sort((a, b) => String(a.name || "").trim().localeCompare(String(b.name || "").trim(), "en", { numeric: true, sensitivity: "base" }));
    const label = attendanceFilter === "present" ? "Present students" : attendanceFilter === "absent" ? "Absent students" : "All students";
    const classLabel = className === "All" ? "All classes" : className;
    const sectionLabel = section === "All" ? "All sections" : "Section " + section;
    const datesLabel = formatDisplayDate(dateFrom) + " – " + formatDisplayDate(dateTo);
    const summaryTable = "<table class=\"summary-table\"><thead><tr><th class=\"serial\">S. No.</th><th>ID Number</th><th>Student Name</th><th>Class &amp; Section</th><th>Status</th><th>Present<br><small>" + escapeHtml(summary.currentMonthLabel) + "</small></th><th>Present<br><small>" + escapeHtml(summary.previousMonthLabel) + "</small></th><th>Session<br><small>Present / Working</small></th></tr></thead><tbody>" + summaryRows(orderedStudents, summary.sessionWorkingDays) + "</tbody></table>";
    const chunks = datesByMonthAndChunk(dates, 14);
    const dailySheets = chunks.map((chunk, index) => {
        const dayHeaders = chunk.dates.map((date) => {
            const weekday = formatDisplayDate(date, { weekday: "short" });
            return "<th class=\"day-column\"><span>" + date.slice(8, 10) + "</span><small>" + escapeHtml(weekday) + "</small></th>";
        }).join("");
        const from = chunk.dates[0];
        const to = chunk.dates[chunk.dates.length - 1];
        const dailyTable = "<table class=\"daily-table\"><thead><tr><th class=\"serial\">S. No.</th><th class=\"id-column\">ID Number</th><th class=\"daily-name\">Student Name</th><th class=\"class-column\">Class &amp; Section</th><th class=\"status-column\">Status</th>" + dayHeaders + "</tr></thead><tbody>" + dailyRows(orderedStudents, chunk.dates, holidays) + "</tbody></table>";
        const monthName = formatDisplayDate(from, { month: "long", year: "numeric" });
        const rangeName = formatDisplayDate(from, { day: "2-digit", month: "short" }) + " – " + formatDisplayDate(to, { day: "2-digit", month: "short", year: "numeric" });
        return "<section class=\"daily-sheet\"><div class=\"daily-heading\"><div><p class=\"eyebrow\">DAILY ATTENDANCE MATRIX · " + escapeHtml(monthName) + " · SHEET " + (index + 1) + " OF " + chunks.length + "</p><h2>" + escapeHtml(rangeName) + "</h2></div><p>" + orderedStudents.length + " students · " + escapeHtml(label) + "</p></div>" + dailyTable + "</section>";
    }).join("");

    const instruction = "Enter/retain only the first biometric punch for each working day. Punch times are shown in Indian local time with AM/PM and without seconds. A means absent on a working day; an em dash means Sunday or a saved holiday. Working-day totals count Monday–Saturday and exclude recorded holidays. Verify dates and totals against the approved calendar before signing and filing.";
    const holidayNote = summary.holidayLoadErrors ? "<p class=\"warning\">Holiday calendar could not be loaded for " + summary.holidayLoadErrors + " month(s). Verify the working-day totals before filing.</p>" : "";
    const styles = '*{box-sizing:border-box}html,body{margin:0;background:#e9eef5;color:#1d2b42;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:14px;padding:11px 16px;background:#173b73;color:#fff;box-shadow:0 3px 14px #0f172a25}.toolbar span{font-size:13px}.toolbar button{border:0;border-radius:8px;padding:9px 16px;background:#fff;color:#173b73;font-weight:700;cursor:pointer}.paper{width:281mm;min-height:194mm;margin:16px auto;padding:0;background:#fff}.school-header{display:grid;grid-template-columns:22mm 1fr 24mm;align-items:center;gap:4mm;padding:0 0 3mm;border-bottom:1.2mm solid #173b73}.school-header img{width:20mm;height:20mm;object-fit:contain}.school-heading{text-align:center}.kicker,.eyebrow{margin:0 0 1mm;color:#087d69;font-size:7pt;font-weight:700;letter-spacing:1.2px}.school-heading h1{margin:0;color:#173b73;font-family:Georgia,Times New Roman,serif;font-size:17pt;line-height:1.2}.school-heading p{margin:1mm 0 0;color:#53627a;font-size:8pt}.school-heading .motto{color:#087d69;font-family:Georgia,Times New Roman,serif;font-size:10pt;font-style:italic;font-weight:700}.official-mark{justify-self:end;border:1px solid #bac9dc;border-radius:2mm;padding:2mm;color:#53627a;font-size:6pt;font-weight:700;line-height:1.5;text-align:center}.title-line{display:flex;align-items:end;justify-content:space-between;gap:8mm;margin:3mm 0 2mm}.title-line h2{margin:0;color:#14213a;font-size:15pt}.report-date{text-align:right}.report-date span{display:block;color:#64748b;font-size:6.5pt;font-weight:700;letter-spacing:.7px}.report-date strong{display:block;margin-top:1mm;color:#173b73;font-size:9pt}.meta{display:grid;grid-template-columns:1.2fr 1fr 1.2fr .7fr;gap:2mm;padding:2.2mm 2.8mm;border:1px solid #d2deeb;border-radius:2mm;background:#f3f7fb}.meta span{display:block;color:#607089;font-size:6pt;font-weight:700;letter-spacing:.65px}.meta strong{display:block;margin-top:1mm;font-size:8pt}.metric-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin:2mm 0}.metric{padding:2mm 2.5mm;border:1px solid #d2deeb;border-radius:2mm;background:#f8fafc}.metric span{display:block;color:#607089;font-size:6pt;font-weight:700;letter-spacing:.45px}.metric strong{display:block;margin-top:.7mm;color:#173b73;font-size:10pt}.instruction{margin:2mm 0;color:#4c5c73;font-size:7pt;line-height:1.4}.warning{margin:1mm 0;color:#98420a;font-size:7pt;font-weight:700}.summary-table,.daily-table{width:100%;border-collapse:collapse;table-layout:fixed}.summary-table th,.daily-table th{padding:1.6mm 1.2mm;border:.3mm solid #7187a5;background:#173b73;color:#fff;font-size:7pt;line-height:1.2;text-align:left;vertical-align:middle}.summary-table th small{font-size:6pt;font-weight:500}.summary-table td,.daily-table td{padding:1.35mm 1.2mm;border:.28mm solid #aab9ca;color:#273449;font-size:7pt;line-height:1.22;vertical-align:middle}.summary-table tbody tr:nth-child(even),.daily-table tbody tr:nth-child(even){background:#f0f5fa}.summary-table .serial,.daily-table .serial{width:9mm;text-align:center;color:#526176}.summary-table th:nth-child(2){width:20mm}.summary-table th:nth-child(3){width:48mm}.summary-table th:nth-child(4){width:29mm}.summary-table th:nth-child(5){width:19mm}.summary-table th:nth-child(6),.summary-table th:nth-child(7){width:27mm;text-align:center}.summary-table th:nth-child(8){width:34mm;text-align:center}.summary-table td:nth-child(6),.summary-table td:nth-child(7),.summary-table td:nth-child(8){text-align:center}.student-name{font-weight:700}.number{font-weight:700;font-variant-numeric:tabular-nums}.present-number,.punch{color:#08795c!important;font-weight:700!important}.status{text-transform:uppercase;font-size:6.5pt!important;font-weight:700}.status.present{color:#08795c!important}.status.absent,.absent{color:#be3245!important}.daily-sheet{margin-top:3mm}.daily-sheet+.daily-sheet{break-before:page;page-break-before:always}.daily-heading{display:flex;justify-content:space-between;align-items:end;margin:0 0 1.5mm}.daily-heading h2{margin:0;color:#173b73;font-size:10pt}.daily-heading>p{margin:0;color:#64748b;font-size:7pt}.daily-table th:nth-child(2){width:19mm}.daily-table th:nth-child(3){width:43mm}.daily-table th:nth-child(4){width:25mm}.daily-table th:nth-child(5){width:18mm}.daily-table .day-column{width:12.4mm;padding:.8mm .3mm;text-align:center}.day-column span,.day-column small{display:block}.day-column small{margin-top:.5mm;font-size:5.5pt;font-weight:500}.daily-table .day-cell{text-align:center;font-size:6.7pt;font-variant-numeric:tabular-nums;white-space:nowrap}.closed{color:#8b98a9!important;font-weight:500}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:16mm;margin:12mm 8mm 3mm;break-inside:avoid}.signature{text-align:center}.signature .line{height:9mm;border-bottom:.3mm solid #51637d}.signature span{display:block;margin-top:2mm;color:#34445a;font-size:7pt;font-weight:700}.filing-note{display:flex;justify-content:space-between;gap:8mm;margin:3mm 0 0;color:#607089;font-size:6pt}.credit{margin-top:2mm;color:#64748b;font-size:6pt;text-align:right}.summary-table td,.daily-table td{overflow-wrap:anywhere}@page{size:A4 landscape;margin:8mm}@media print{html,body{width:auto!important;margin:0!important;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none!important}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.school-header,.title-line,.meta,.metric-strip,.instruction,.warning,.daily-heading{break-inside:avoid;page-break-inside:avoid}.summary-table,.daily-table{display:table!important;width:100%!important;border-collapse:collapse!important}.summary-table thead,.daily-table thead{display:table-header-group}.summary-table tr,.daily-table tr{break-inside:avoid;page-break-inside:avoid}.summary-table th,.daily-table th{border:.3mm solid #7187a5!important;background:#173b73!important;color:#fff!important}.summary-table td,.daily-table td{border:.28mm solid #9aabc0!important}.summary-table tbody tr:nth-child(even),.daily-table tbody tr:nth-child(even){background:#f0f5fa!important}.daily-sheet+.daily-sheet{break-before:page;page-break-before:always}.signatures{break-inside:avoid;page-break-inside:avoid}}';
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attendance Register · ' + escapeHtml(schoolName) + '</title><style>' + styles + '</style></head><body><nav class="toolbar"><span>Attendance register · A4 Landscape · use Ctrl+P / ⌘P to print</span><button type="button" onclick="window.print()">Print register</button></nav><main class="paper">' +
        schoolHeader(schoolName) +
        '<div class="title-line"><div><p class="eyebrow">OFFICIAL RECORD · BIOMETRIC REGISTER</p><h2>Employee Attendance Register</h2></div><div class="report-date"><span>REPORT PERIOD</span><strong>' + escapeHtml(datesLabel) + '</strong></div></div>' +
        '<div class="meta"><div><span>BRANCH</span><strong>' + escapeHtml(classLabel) + '</strong></div><div><span>DEPARTMENT</span><strong>' + escapeHtml(sectionLabel) + '</strong></div><div><span>ATTENDANCE FILTER</span><strong>' + escapeHtml(label) + '</strong></div><div><span>EMPLOYEES</span><strong>' + orderedStudents.length + '</strong></div></div>' +
        '<div class="metric-strip"><div class="metric"><span>WORKING DAYS · SELECTED RANGE</span><strong>' + summary.selectedRangeWorkingDays + '</strong></div><div class="metric"><span>WORKING DAYS · ' + escapeHtml(summary.currentMonthLabel.toLocaleUpperCase("en")) + '</span><strong>' + summary.currentMonthWorkingDays + '</strong></div><div class="metric"><span>WORKING DAYS · ' + escapeHtml(summary.previousMonthLabel.toLocaleUpperCase("en")) + '</span><strong>' + summary.previousMonthWorkingDays + '</strong></div><div class="metric"><span>WORKING DAYS · PERIOD</span><strong>' + summary.sessionWorkingDays + ' <small>(' + escapeHtml(summary.sessionLabel) + ')</small></strong></div></div>' +
        '<p class="instruction">' + escapeHtml(instruction) + '</p>' + holidayNote + '<h3 class="eyebrow">EMPLOYEE SUMMARY · FIRST PUNCH TOTALS</h3>' + summaryTable + dailySheets +
        '<div class="signatures"><div class="signature"><div class="line"></div><span>Site Supervisor</span></div><div class="signature"><div class="line"></div><span>Attendance In-charge</span></div><div class="signature"><div class="line"></div><span>Manager / Director</span></div></div><p class="filing-note"><span>Prepared for company record · Verify attendance and working days against the approved calendar before filing.</span><span>Session opened: ' + escapeHtml(formatDisplayDate(sessionStartDate)) + '</span></p><p class="credit">Designed &amp; Developed by AKASH · Software Engineer</p></main></body></html>';
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
}
