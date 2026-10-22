import { formatDate, monthName } from "@/lib/utils";

const SCHOOL_NAME = "KM Builders";

/* ── Helper: safe number (never null/undefined/NaN) ────── */
function safe(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/* ── Helper: ₹ format with Indian comma grouping ──────── */
function rupee(value) {
    const n = safe(value);
    return `₹${n.toLocaleString("en-IN")}`;
}

/* ── Helper: Days format ───────────────────────────────── */
function days(value) {
    return `${safe(value)} Days`;
}

/* ── Helper: short month name (3 letters) ──────────────── */
function shortMonth(month) {
    return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(2024, month - 1, 1));
}

/* ── Helper: DD-MMM-YYYY date format ───────────────────── */
function ledgerDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const mon = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d);
    const year = d.getFullYear();
    return `${day}-${mon}-${year}`;
}

/* ═══════════════════════════════════════════════════════════
   Salary Ledger (Reports page — multi-employee)
   ═══════════════════════════════════════════════════════════ */

export const salaryLedgerColumns = [
    "S.No",
    "Employee ID",
    "Employee Name",
    "Father/Spouse Name",
    "Role/Designation",
    "Department/Subject",
    "Phone",
    "Joining Date",
    "Employment Status",
    "Bank Account Number",
    "IFSC Code",
    "Address",
    "Month",
    "Year",
    "Base Salary",
    "Per Day Salary",
    "Total Working Days",
    "Days Present",
    "Absent Days",
    "CL Remaining",
    "Casual Leave Taken (Full)",
    "Half CL Taken",
    "Equivalent CL Used",
    "Excess Casual Leave",
    "Emergency Leave",
    "Deductible Absence",
    "Absence Deduction",
    "Excess CL Deduction",
    "Bonus",
    "Advance Given",
    "Advance Deduction",
    "PF Amount",
    "Remaining Advance",
    "Total Deduction",
    "Net Salary",
    "Payment Status",
    "Payment Date"
];

export function exportSalaryLedgerExcel({ salaries, title = "Salary Ledger Report", subtitle, fileName = "salary-ledger-report.xls" }) {
    const rows = salaries.map((salary, index) => [
        index + 1,
        salary.employeeId || "",
        salary.employee?.name || salary.employeeId || "",
        salary.employee?.fatherOrSpouseName || "",
        salary.employee?.role || "",
        salary.employee?.department || "",
        salary.employee?.phone || "",
        salary.employee?.joiningDate || "",
        salary.employee?.status || "Active",
        salary.employee?.bankDetails?.accountNumber || "",
        salary.employee?.bankDetails?.ifscCode || "",
        salary.employee?.address || "",
        monthName(salary.month),
        salary.year,
        salary.baseSalary,
        salary.perDaySalary || 0,
        salary.workingDays,
        salary.daysPresent,
        salary.absentDays,
        salary.remainingCL != null ? salary.remainingCL : Math.max((salary.totalCL || 14) - ((salary.casualLeave || 0) + (salary.halfCLTaken || 0) / 2), 0),
        salary.casualLeave || 0,
        salary.halfCLTaken || 0,
        salary.equivalentCLUsed || 0,
        salary.excessCL || 0,
        salary.emergencyLeave || 0,
        salary.deductibleAbsence || 0,
        salary.absenceDeduction || 0,
        salary.excessCLDeduction || 0,
        salary.bonus || 0,
        salary.advanceGiven || 0,
        salary.advanceDeduction || 0,
        salary.pfAmount || 0,
        salary.remainingAdvance || 0,
        salary.totalDeduction || 0,
        salary.netSalary || 0,
        salary.status === "Paid" ? "Paid" : "Unpaid",
        salary.paymentDate ? formatDate(salary.paymentDate) : ""
    ]);
    downloadExcelWorkbook({
        columns: salaryLedgerColumns,
        rows,
        title,
        subtitle,
        fileName,
        numericColumns: new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34])
    });
}

/* ═══════════════════════════════════════════════════════════
   Employee Ledger (Employees → Salary History)
   STRICT FORMAT — 24 columns with ₹ / Days / DD-MMM-YYYY
   ═══════════════════════════════════════════════════════════ */

export function exportEmployeeLedgerExcel({ employee, salaries, year, fileName }) {
    const columns = [
        "S.No",
        "Month",
        "Base Salary",
        "Per Day Salary",
        "Total Working Days",
        "Days Present",
        "Absent Days",
        "Casual Leave",
        "Half CL",
        "Equivalent CL",
        "Excess Leave",
        "Emergency Leave",
        "Deductible Absence",
        "Absence Deduction (₹)",
        "Excess CL Deduction (₹)",
        "Bonus (₹)",
        "Advance Given (₹)",
        "Advance Deduction (₹)",
        "PF (₹)",
        "Remaining Advance (₹)",
        "Total Deduction (₹)",
        "Net Salary (₹)",
        "Payment Status",
        "Paid Date"
    ];

    const rows = salaries.map((salary, index) => [
        /* 0  S.No                */  index + 1,
        /* 1  Month               */  `${shortMonth(salary.month)}-${String(salary.year).slice(-2)}`,
        /* 2  Base Salary         */  rupee(salary.baseSalary),
        /* 3  Per Day Salary      */  rupee(salary.perDaySalary),
        /* 4  Total Working Days  */  days(salary.workingDays),
        /* 5  Days Present        */  days(salary.daysPresent),
        /* 6  Absent Days         */  days(salary.absentDays),
        /* 7  Casual Leave        */  days(salary.casualLeave),
        /* 8  Half CL             */  `${Number(salary.halfCLTaken || 0)} Half Days`,
        /* 9  Equivalent CL       */  days(salary.equivalentCLUsed || Number(salary.casualLeave || 0) + Number(salary.halfCLTaken || 0) / 2),
        /* 10 Excess Leave        */  days(salary.excessCL),
        /* 11 Emergency Leave     */  days(salary.emergencyLeave),
        /* 12 Deductible Absence  */  days(salary.deductibleAbsence),
        /* 13 Absence Deduction   */  rupee(salary.absenceDeduction),
        /* 14 Excess CL Deduction */  rupee(salary.excessCLDeduction),
        /* 15 Bonus (₹)           */  rupee(salary.bonus),
        /* 16 Advance Given (₹)   */  rupee(salary.advanceGiven),
        /* 17 Advance Deduction   */  rupee(salary.advanceDeduction),
        /* 18 PF (₹)              */  rupee(salary.pfAmount),
        /* 19 Remaining Advance   */  rupee(salary.remainingAdvance),
        /* 20 Total Deduction     */  rupee(salary.totalDeduction),
        /* 21 Net Salary (₹)      */  rupee(salary.netSalary),
        /* 22 Payment Status      */  salary.status === "Paid" ? "Paid" : "Unpaid",
        /* 23 Paid Date           */  salary.paymentDate ? ledgerDate(salary.paymentDate) : "Unpaid"
    ]);

    /* Column alignment map: "right" for ₹ fields, "center" for Days fields */
    const alignMap = {
        0: "center",   /* S.No */
        1: "left",     /* Month */
        2: "right",    /* Base Salary ₹ */
        3: "right",    /* Per Day Salary ₹ */
        4: "center",   /* Total Working Days */
        5: "center",   /* Days Present */
        6: "center",   /* Absent Days */
        7: "center",   /* Casual Leave */
        8: "center",   /* Half CL */
        9: "center",   /* Equivalent CL */
        10: "center",  /* Excess Leave */
        11: "center",  /* Emergency Leave */
        12: "center",  /* Deductible Absence */
        13: "right",   /* Absence Deduction ₹ */
        14: "right",   /* Excess CL Deduction ₹ */
        15: "right",   /* Bonus ₹ */
        16: "right",   /* Advance Given ₹ */
        17: "right",   /* Advance Deduction ₹ */
        18: "right",   /* PF ₹ */
        19: "right",   /* Remaining Advance ₹ */
        20: "right",   /* Total Deduction ₹ */
        21: "right",   /* Net Salary ₹ */
        22: "center",  /* Payment Status */
        23: "center"   /* Paid Date */
    };

    downloadEmployeeLedgerWorkbook({
        columns,
        rows,
        title: SCHOOL_NAME,
        subtitle: `Employee Salary Ledger — ${employee.name} (${employee.employeeId}) — ${year || "All Years"}`,
        fileName: fileName || `${employee.employeeId}-salary-ledger.xls`,
        alignMap
    });
}

/* ═══════════════════════════════════════════════════════════
   Generic Excel workbook generator (Reports page)
   ═══════════════════════════════════════════════════════════ */

function downloadExcelWorkbook({ columns, rows, title, subtitle, fileName, numericColumns }) {
    const tableRows = [
        `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`,
        ...rows.map((row, rowIndex) => `<tr class="${rowIndex % 2 === 0 ? "even" : "odd"}">${row
            .map((cell, index) => {
                const isNum = numericColumns.has(index);
                const isTextFormatted = index === 1 || index === 6 || index === 9 || index === 10;
                const style = isTextFormatted ? ' style="mso-number-format:\'\\@\'"' : '';
                return `<td class="${isNum ? "num" : ""}"${style}>${escapeHtml(String(cell ?? ""))}</td>`;
            })
            .join("")}</tr>`)
    ].join("");
    const workbook = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #172033; }
            .title { font-size: 20px; font-weight: 800; color: #1e40af; text-align: center; }
            .subtitle { font-size: 13px; font-weight: 700; color: #475569; text-align: center; margin-bottom: 14px; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #1e40af; color: #ffffff; border: 1px solid #93c5fd; padding: 9px 10px; font-size: 12px; }
            td { border: 1px solid #dbeafe; padding: 8px 10px; font-size: 11px; vertical-align: middle; }
            tr.even td { background: #eff6ff; }
            tr.odd td { background: #ffffff; }
            td.num { text-align: right; mso-number-format: "#,##0.00"; }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(title || SCHOOL_NAME)}</div>
          <div class="subtitle">${escapeHtml(subtitle || "Salary Ledger Report")}</div>
          <table>${tableRows}</table>
        </body>
      </html>
    `;
    triggerDownload(workbook, fileName);
}

/* ═══════════════════════════════════════════════════════════
   Employee Ledger workbook (strict format with alignment)
   ═══════════════════════════════════════════════════════════ */

function downloadEmployeeLedgerWorkbook({ columns, rows, title, subtitle, fileName, alignMap }) {
    /* Header row */
    const headerCells = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");

    /* Data rows with per-column alignment */
    const dataRows = rows.map((row, rowIndex) => {
        const cells = row.map((cell, colIndex) => {
            const align = alignMap[colIndex] || "left";
            return `<td style="text-align:${align};">${escapeHtml(String(cell ?? ""))}</td>`;
        }).join("");
        return `<tr class="${rowIndex % 2 === 0 ? "even" : "odd"}">${cells}</tr>`;
    }).join("");

    const workbook = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #172033; }
            .title { font-size: 20px; font-weight: 800; color: #1e40af; text-align: center; margin-bottom: 4px; }
            .subtitle { font-size: 13px; font-weight: 600; color: #475569; text-align: center; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; }
            th {
              background: #1e40af;
              color: #ffffff;
              border: 1px solid #93c5fd;
              padding: 10px 12px;
              font-size: 12px;
              font-weight: 700;
              text-align: center;
              white-space: nowrap;
            }
            td {
              border: 1px solid #dbeafe;
              padding: 8px 12px;
              font-size: 11px;
              vertical-align: middle;
              white-space: nowrap;
            }
            tr.even td { background: #eff6ff; }
            tr.odd td { background: #ffffff; }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(title || SCHOOL_NAME)}</div>
          <div class="subtitle">${escapeHtml(subtitle || "Employee Salary Ledger")}</div>
          <table>
            <tr>${headerCells}</tr>
            ${dataRows}
          </table>
        </body>
      </html>
    `;
    triggerDownload(workbook, fileName);
}

/* ── Shared download trigger ───────────────────────────── */

function triggerDownload(htmlContent, fileName) {
    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
}

/* ── HTML escaping ─────────────────────────────────────── */

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
