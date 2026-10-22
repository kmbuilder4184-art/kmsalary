"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { formatDate, monthName } from "@/lib/utils";
import { parseEsslSalaryNote } from "@/lib/essl-salary/report-data";

const ASSET_BASE = "/salary-slip";
const COMPANY_LOGO = "/km-builders-logo.png";

export function SalarySlipClient({ id }) {
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const slipRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/salaries/${id}`, { cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      setSalary(data?.salary || null);
      setLoading(false);
    }

    load();
  }, [id]);

  async function downloadPdf() {
    if (!slipRef.current || !salary) return;

    setDownloading(true);
    const canvas = await html2canvas(slipRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "mm", "a5");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const width = canvas.width * scale;
    const height = canvas.height * scale;
    pdf.addImage(image, "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
    pdf.save(`${salary.employeeId}-${monthName(salary.month)}-${salary.year}-salary-slip.pdf`);
    setDownloading(false);
  }

  if (loading) {
    return (
      <Card>
        <EmptyState title="Loading salary slip" description="Please wait while the salary slip is prepared." />
      </Card>
    );
  }

  if (!salary) {
    return (
      <Card>
        <EmptyState title="Salary slip not found" description="The selected salary record is not available." />
      </Card>
    );
  }

  const slip = mapSalaryToSlip(salary);
  const hasPfDeduction = slip.pfAmount > 0;

  return (
    <div className="salary-slip-screen">
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/essl-salary-report">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={downloadPdf} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="salary-slip-preview">
        <div ref={slipRef} className="salary-slip-template a5-compact">
          <div className="salary-slip">
            <div className="watermark">
              <img src={COMPANY_LOGO} alt="Watermark" />
            </div>

            <div className="slip-header">
              <div className="logo-container">
                <img src={COMPANY_LOGO} alt="Company Logo" />
              </div>
              <div className="header-info">
                <div className="school-name">KM Builders</div>
                <div className="school-address">Property Developers</div>
                <div className="school-affiliation">
                  Employee Salary Management System
                </div>
              </div>
              <div className="slip-title-block">
                <div className="slip-title">Salary Slip</div>
                <div className="slip-meta">
                  <span>Month: {slip.monthYear}</span>
                  <span>Slip ID: {slip.slipId}</span>
                </div>
              </div>
            </div>

            <div className="employee-section">
              <div className="employee-grid">
                <SlipField label="Name:" value={slip.employeeName} />
                <SlipField label="Emp ID:" value={slip.employeeId} />
                <SlipField label="Designation:" value={slip.designation} />
                <SlipField label="Department:" value={slip.department} />
                <SlipField label="Bank A/C:" value={slip.bankAccount} />
                <SlipField label="IFSC:" value={slip.ifscCode} />
              </div>
            </div>

            <div className="financials">
              <div className="fin-column">
                <div className="fin-header earnings-header">
                  <span>Earnings</span>
                  <span>Amount (₹)</span>
                </div>
                <SlipLine label={slip.earnedDaysPolicy ? `Salary for days worked (${slip.presentDays} full + ${slip.workedHalfDays} half)` : slip.profileBasePolicy ? "Base Salary (Employee Profile)" : slip.isEsslCalculator ? "Work Day Earnings" : "Basic Salary"} value={formatSlipCurrency(slip.earnedDaysPolicy ? slip.workedDaysSalary : slip.basicSalary)} />
                {slip.earnedDaysPolicy ? <SlipLine label={`Paid CL — Full Day (${slip.fullClDaysUsed} days × ${formatSlipCurrency(slip.dailyRate)})`} value={formatSlipCurrency(slip.paidClFullDaySalary)} /> : null}
                {slip.earnedDaysPolicy ? <SlipLine label={`Paid CL — Half Day (${slip.halfClDaysUsed} half-days = ${slip.paidClDays - slip.fullClDaysUsed} equivalent days)`} value={formatSlipCurrency(slip.paidClHalfDaySalary)} /> : null}
                {slip.earnedDaysPolicy && slip.emergencyLeaveSalary > 0 ? <SlipLine label={`Paid Emergency Leave (${slip.paidEmergencyLeaveDays} days)`} value={formatSlipCurrency(slip.emergencyLeaveSalary)} /> : null}
                {slip.isEsslCalculator && !slip.profileBasePolicy ? <SlipLine label={`CL Full Day Pay (${slip.fullClDaysUsed} CL Full Day × ${formatSlipCurrency(slip.dailyRate)})`} value={formatSlipCurrency(slip.clSalary)} /> : null}
                {slip.isEsslCalculator && !slip.profileBasePolicy && slip.clHalfSalary > 0 ? <SlipLine label={`CL Half Day Pay (${slip.halfClDaysUsed} half-days × ½ daily rate)`} value={formatSlipCurrency(slip.clHalfSalary)} /> : null}
                {slip.isEsslCalculator ? <SlipLine label={`Sunday pay (${slip.paidSundays} × ${formatSlipCurrency(slip.dailyRate)})`} value={formatSlipCurrency(slip.sundayPay)} /> : null}
                {slip.isEsslCalculator ? <SlipLine label={`Holiday pay (${slip.paidHolidays} × ${formatSlipCurrency(slip.dailyRate)})`} value={formatSlipCurrency(slip.holidayPay)} /> : null}
                <SlipLine label={slip.isEsslCalculator && slip.bonusClUsed ? `Full Attendance Bonus (${slip.bonusClUsed} CL used)` : "Bonus"} value={formatSlipCurrency(slip.bonus)} />
                {!slip.earnedDaysPolicy ? <SlipSpacerLine /> : null}
                {!slip.earnedDaysPolicy && hasPfDeduction ? <SlipSpacerLine /> : null}
                <div className="fin-total-row total-earnings">
                  <span>Gross Earnings</span>
                  <span>{formatSlipCurrency(slip.grossEarnings)}</span>
                </div>
              </div>

              <div className="fin-column">
                <div className="fin-header deductions-header">
                  <span>Deductions</span>
                  <span>Amount (₹)</span>
                </div>
                {slip.earnedDaysPolicy ? <div className="attendance-note">Unpaid attendance · information only, not deducted again</div> : null}
                <SlipLine label={slip.earnedDaysPolicy ? `Unpaid Absence Amount (${slip.unpaidAbsenceDays} days; not deducted again)` : slip.isEsslCalculator ? "Absence Deduction (from base pay)" : "Absence Deduction"} value={formatSlipCurrency(slip.absenceDeduction)} />
                {slip.isEsslCalculator ? <SlipLine label={slip.earnedDaysPolicy ? `Unpaid half-days (${Math.max(0, slip.halfDays - slip.halfClDaysUsed)} × ½ daily rate; not deducted again)` : `Half-day deduction from base pay (${Math.max(0, slip.halfDays - slip.halfClDaysUsed)} uncovered half-days × ½ × ${formatSlipCurrency(slip.dailyRate)}); CL Full Day ${slip.fullClDaysUsed} + CL Half Day ${slip.halfClDaysUsed} (${slip.halfClDaysUsed / 2} CL) + Bonus CL ${slip.bonusClUsed}; Total CL Taken ${slip.clTaken}`} value={formatSlipCurrency(slip.halfDayDeduction)} /> : null}
                <SlipLine label={slip.earnedDaysPolicy ? "Excess CL (if any)" : "Excess CL Deduction"} value={formatSlipCurrency(0)} />
                {slip.earnedDaysPolicy ? <div className="attendance-note actual-deduction-note">Actual deductions from salary</div> : null}
                {slip.isEsslCalculator ? <SlipLine label="Previous Pending Advance" value={formatSlipCurrency(slip.previousPendingAdvance)} /> : null}
                {slip.isEsslCalculator ? <SlipLine label="Company Expense in Advance Pool" value={formatSlipCurrency(slip.schoolExpense)} /> : null}
                {slip.isEsslCalculator ? <SlipLine label="New Advance Given" value={formatSlipCurrency(slip.newAdvanceGiven)} /> : null}
                {slip.isEsslCalculator ? <SlipLine label="Total Advance Pool" value={formatSlipCurrency(slip.advancePool)} /> : null}
                <SlipLine label={slip.isEsslCalculator ? "Advance Deduction" : "Advance Salary Ded."} value={formatSlipCurrency(slip.advanceSalaryDeduction)} />
                {slip.isEsslCalculator ? <SlipLine label="Remaining Advance" value={formatSlipCurrency(slip.remainingAdvance)} /> : null}
                {hasPfDeduction ? <SlipLine label="PF Deduction" value={formatSlipCurrency(slip.pfAmount)} /> : null}
                <div className="fin-total-row total-deductions">
                  <span>{slip.earnedDaysPolicy ? "Total Deductions from Salary" : "Total Deductions"}</span>
                  <span>{formatSlipCurrency(slip.totalDeductions)}</span>
                </div>
              </div>
            </div>

            {slip.profileBasePolicy ? slip.earnedDaysPolicy ? <div className="salary-calculation-summary">
              <div><strong>Calculation basis:</strong> Monthly base {formatSlipCurrency(slip.monthlyBaseSalary)} · Daily rate {formatSlipCurrency(slip.dailyRate)} · Paid CL {slip.fullClDaysUsed} full + {slip.halfClDaysUsed} half ({slip.paidClDays} equivalent days)</div>
              <div><strong>Unpaid attendance:</strong> {formatSlipCurrency(slip.attendanceDeductions)} shown for clarity; already excluded from earned pay, so it is not deducted again. Advance and PF above are the actual salary deductions.</div>
            </div> : <div className={`my-4 grid gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 sm:grid-cols-3 print:bg-white`}>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Monthly profile base salary</p><p className="mt-1 font-bold">{formatSlipCurrency(slip.monthlyBaseSalary)}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Salary for paid work + leave</p><p className="mt-1 font-bold">{formatSlipCurrency(slip.baseSalaryEarnings)}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Absence + half-day deductions</p><p className="mt-1 font-bold text-rose-700">−{formatSlipCurrency(slip.attendanceDeductions)}</p></div>
              <p className="text-xs text-indigo-800 sm:col-span-3">Daily rate {formatSlipCurrency(slip.dailyRate)} · Paid CL: {slip.fullClDaysUsed} full days + {slip.halfClDaysUsed} half-days ({slip.halfClDaysUsed / 2} equivalent CL days). Add-on earnings (Sunday + holiday + bonus): {formatSlipCurrency(slip.additionalEarnings)}.</p>
            </div> : null}

            {!slip.earnedDaysPolicy ? <div className={`balance-after-deductions ${slip.balanceAfterDeductions < 0 ? "balance-negative" : "balance-positive"}`}>
              <span>Final Salary After All Deductions</span>
              <span>{formatSlipCurrency(slip.balanceAfterDeductions)}</span>
            </div> : null}

            <div className="net-salary-section">
              <div>
                <div className="net-label">Net Salary Payable</div>
                <div className="net-words">{numberToWords(Math.round(slip.netSalary))}</div>
              </div>
              <div className="net-amount">{formatSlipCurrency(slip.netSalary)}</div>
            </div>

            {slip.remarks ? <div className="remarks-section">
              <div className="remarks-label">Remarks / Notes</div>
              <div className="remarks-text">{slip.remarks}</div>
            </div> : null}

            <div className="slip-footer">
              <div className="footer-left">
                <FooterField
                  label="Payment Status"
                  value={<span className={slip.status === "Paid" ? "status-paid" : "status-pending"}>{slip.status.toUpperCase()}</span>}
                />
                <FooterField label="Payment Date" value={slip.paymentDate} />
                <div className="footer-field">
                  <span className="footer-label">Payment Mode</span>
                  <span className="footer-value">
                    <span className="pay-mode-printed">{paymentMode}</span>
                    <span className="pay-mode-toggle no-print">
                      {["Bank Transfer", "Cash"].map((mode) => (
                        <button
                          className={`mode-btn ${paymentMode === mode ? "active" : ""}`}
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMode(mode)}
                        >
                          {mode}
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
              </div>

              <div className="stamp-signature-wrap">
                <div className="signature-block">
                  <img src={`${ASSET_BASE}/signature.png`} alt="Signature" className="signature-img" />
                  <div className="signature-line" />
                  <div className="signature-label">Authorized Signatory</div>
                </div>
                <img src={`${ASSET_BASE}/stamp.png`} alt="Company Stamp" className="stamp-img" />
              </div>
            </div>

            <div className="system-note">
              This is a system-generated salary slip and does not require a physical signature.
              <br />
              For queries, contact: <strong>hr@kmbuilders.com</strong>
            </div>

            <div className="cut-line-label">✂ Cut Here</div>
          </div>

          <div className="blank-half" />
        </div>
      </div>

      <style>{salarySlipCss}</style>
    </div>
  );
}

function SlipField({ label, value }) {
  return (
    <div className="emp-field">
      <span className="emp-label">{label}</span>
      <span className="emp-value">{value}</span>
    </div>
  );
}

function SlipLine({ label, value }) {
  return (
    <div className="fin-row">
      <span className="fin-row-label">{label}</span>
      <span className="fin-row-value">{value}</span>
    </div>
  );
}

function SlipSpacerLine() {
  return (
    <div className="fin-row fin-spacer-row" aria-hidden="true">
      <span className="fin-row-label">&nbsp;</span>
      <span className="fin-row-value">&nbsp;</span>
    </div>
  );
}

function FooterField({ label, value }) {
  return (
    <div className="footer-field">
      <span className="footer-label">{label}</span>
      <span className="footer-value">{value}</span>
    </div>
  );
}

function mapSalaryToSlip(salary) {
  const employee = salary.employee || {};
  const bankDetails = employee.bankDetails || {};
  const esslData = parseEsslSalaryNote(salary.notes);
  const isEsslCalculator = Boolean(esslData);
  const earnedDaysPolicy = Number(esslData?.salaryPolicyVersion) >= 3;
  const profileBasePolicy = Number(esslData?.salaryPolicyVersion) >= 2;
  const basicSalary = toSlipAmount(profileBasePolicy ? (esslData.baseSalary ?? salary.baseSalary) : (esslData?.schoolDayEarnings ?? salary.baseSalary));
  const clSalary = toSlipAmount(esslData?.clSalary);
  const clHalfSalary = toSlipAmount(esslData?.clHalfSalary);
  const sundayPay = toSlipAmount(esslData?.sundayPay);
  const holidayPay = toSlipAmount(esslData?.holidayPay);
  const bonus = toSlipAmount(esslData?.bonus ?? salary.bonus);
  const absenceDeduction = isEsslCalculator ? toSlipAmount(esslData.absenceDeduction) : toSlipAmount(salary.absenceDeduction);
  const halfDayDeduction = toSlipAmount(esslData?.halfDayDeduction);
  const excessCLDeduction = 0;
  const advanceSalaryDeduction = toSlipAmount(esslData?.advanceDeduction ?? salary.advanceDeduction);
  const ledgerSalaryDeduction = toSlipAmount(salary.ledgerDeduction);
  const savedTotalDeduction = toSlipAmount(esslData?.deductions ?? salary.totalDeduction);
  const savedNetSalary = toSlipAmount(esslData?.netSalary ?? salary.netSalary);
  const grossEarnings = roundSlipAmount(earnedDaysPolicy
    ? esslData?.gross ?? (toSlipAmount(esslData?.baseSalaryEarnings) + sundayPay + holidayPay + bonus)
    : profileBasePolicy
      ? basicSalary + sundayPay + holidayPay + bonus
      : esslData?.gross ?? (basicSalary + clSalary + bonus));
  const additionalEarnings = profileBasePolicy
    ? toSlipAmount(esslData.additionalEarnings ?? (sundayPay + holidayPay + bonus))
    : 0;
  const baseSalaryEarnings = isEsslCalculator
    ? toSlipAmount(earnedDaysPolicy ? esslData.baseSalaryEarnings : profileBasePolicy ? basicSalary : (esslData.baseSalaryEarnings ?? (basicSalary + clSalary + clHalfSalary)))
    : 0;
  const attendanceDeductions = isEsslCalculator
    ? toSlipAmount(esslData.attendanceDeductions ?? (absenceDeduction + halfDayDeduction))
    : 0;
  const baseSalaryAfterAttendanceDeductions = isEsslCalculator
    ? toSlipAmount(earnedDaysPolicy ? baseSalaryEarnings : profileBasePolicy ? Math.max(0, baseSalaryEarnings - attendanceDeductions) : (esslData.baseSalaryAfterAttendanceDeductions ?? Math.max(0, baseSalaryEarnings - attendanceDeductions)))
    : 0;
  const visibleDeductionsBeforePf = roundSlipAmount(absenceDeduction + halfDayDeduction + excessCLDeduction + advanceSalaryDeduction);
  const pfAmount = isEsslCalculator ? toSlipAmount(esslData.pfAmount ?? esslData.otherDeduction) : resolvePfAmount({
    explicitPfAmount: salary.pfAmount,
    savedTotalDeduction,
    savedNetSalary,
    grossEarnings,
    additionalEarnings,
    visibleDeductionsBeforePf
  });
  const totalDeductions = isEsslCalculator ? toSlipAmount(esslData.deductions) : roundSlipAmount(
    visibleDeductionsBeforePf + (pfAmount > 0 ? pfAmount : 0)
  );
  const balanceAfterDeductions = roundSlipAmount(earnedDaysPolicy ? (esslData?.netSalary ?? grossEarnings) : grossEarnings - totalDeductions);
  const netSalary = roundSlipAmount(earnedDaysPolicy ? (esslData?.netSalary ?? grossEarnings) : (esslData?.netSalary ?? Math.max(balanceAfterDeductions, 0)));

  return {
    employeeName: employee.name || salary.employeeId,
    employeeId: salary.employeeId,
    designation: employee.role || "Employee",
    department: employee.department || "Not recorded",
    bankAccount: bankDetails.accountNumber || "Not recorded",
    ifscCode: bankDetails.ifscCode || "Not recorded",
    monthYear: `${monthName(salary.month)} ${salary.year}`,
    slipId: buildSlipId(salary),
    basicSalary,
    clSalary,
    clHalfSalary,
    sundayPay,
    holidayPay,
    isEsslCalculator,
    profileBasePolicy,
    earnedDaysPolicy,
    fullClDaysUsed: Number(esslData?.fullClDaysUsed) || 0,
    halfClDaysUsed: Number(esslData?.halfClDaysUsed) || 0,
    clTaken: Number(esslData?.clTaken) || 0,
    bonusClUsed: Number(esslData?.bonusClUsed) || 0,
    halfDays: Number(esslData?.halfDays) || 0,
    unpaidAbsenceDays: Number(esslData?.unpaidAbsenceDays) || 0,
    presentDays: Number(esslData?.presentDays) || 0,
    workedHalfDays: Number(esslData?.halfDays) || 0,
    workedDaysSalary: toSlipAmount(esslData?.workedDaysSalary),
    paidClDays: Number(esslData?.paidClDays ?? (Number(esslData?.fullClDaysUsed || 0) + Number(esslData?.halfClDaysUsed || 0) / 2)) || 0,
    paidClFullDaySalary: toSlipAmount(esslData?.clSalary),
    paidClHalfDaySalary: toSlipAmount(esslData?.clHalfSalary),
    paidEmergencyLeaveDays: Number(esslData?.paidEmergencyLeaveDays) || 0,
    emergencyLeaveSalary: toSlipAmount(esslData?.emergencyLeaveSalary),
    dailyRate: toSlipAmount(esslData?.dailyRate),
    paidSundays: Number(esslData?.paidSundays) || 0,
    paidHolidays: Number(esslData?.paidHolidays) || 0,
    bonus,
    previousPendingAdvance: toSlipAmount(esslData?.previousPendingAdvance ?? salary.previousPendingAdvance),
    schoolExpense: toSlipAmount(esslData?.schoolExpense ?? salary.ledgerDeduction),
    newAdvanceGiven: toSlipAmount(esslData?.newAdvanceGiven ?? salary.advanceGiven),
    advancePool: toSlipAmount(esslData?.advancePool ?? (Number(salary.previousPendingAdvance || 0) + Number(salary.ledgerDeduction || 0) + Number(salary.advanceGiven || 0))),
    remainingAdvance: toSlipAmount(esslData?.remainingAdvance ?? salary.remainingAdvance),
    grossEarnings,
    baseSalaryEarnings,
    monthlyBaseSalary: isEsslCalculator ? toSlipAmount(esslData.baseSalary ?? salary.baseSalary) : 0,
    attendanceDeductions,
    baseSalaryAfterAttendanceDeductions,
    absenceDeduction,
    halfDayDeduction,
    excessCLDeduction,
    advanceSalaryDeduction,
    ledgerSalaryDeduction,
    pfAmount,
    totalDeductions,
    balanceAfterDeductions,
    netSalary,
    status: salary.status === "Paid" ? "Paid" : "Unpaid",
    paymentDate: salary.paymentDate ? formatDate(salary.paymentDate) : "Unpaid",
    remarks: (String(salary.notes || "").startsWith("ESSL Calculator:")
      ? esslData?.manualNotes
      : salary.notes)?.trim() || ""
  };
}

function toSlipAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? roundSlipAmount(Math.max(number, 0)) : 0;
}

function resolvePfAmount({ explicitPfAmount, savedTotalDeduction, savedNetSalary, grossEarnings, visibleDeductionsBeforePf }) {
  const pfAmount = toSlipAmount(explicitPfAmount);
  if (pfAmount > 0) return pfAmount;

  const pfFromTotalDeduction = roundSlipAmount(savedTotalDeduction - visibleDeductionsBeforePf);
  if (pfFromTotalDeduction > 0) return pfFromTotalDeduction;

  const pfFromNetSalary = roundSlipAmount(grossEarnings - savedNetSalary - visibleDeductionsBeforePf);
  return pfFromNetSalary > 0 ? pfFromNetSalary : 0;
}

function roundSlipAmount(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildSlipId(salary) {
  const month = String(salary.month || 1).padStart(2, "0");
  const suffix = String(salary._id || salary.employeeId || "001").slice(-3).toUpperCase().padStart(3, "0");
  return `SBIC/${salary.year}/${month}/${suffix}`;
}

function formatSlipCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function numberToWords(value) {
  let num = Math.max(Number(value) || 0, 0);
  if (num === 0) return "Zero Rupees Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanThousand(input) {
    let n = input;
    let result = "";

    if (n >= 100) {
      result += `${ones[Math.floor(n / 100)]} Hundred `;
      n %= 100;
      if (n > 0) result += "and ";
    }

    if (n >= 20) {
      result += `${tens[Math.floor(n / 10)]} `;
      n %= 10;
    }

    if (n > 0) result += `${ones[n]} `;
    return result;
  }

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore > 0) result += `${convertLessThanThousand(crore)}Crore `;
  if (lakh > 0) result += `${convertLessThanThousand(lakh)}Lakh `;
  if (thousand > 0) result += `${convertLessThanThousand(thousand)}Thousand `;
  result += convertLessThanThousand(num);

  return `${result.trim()} Rupees Only`;
}

const salarySlipCss = `
.salary-slip-preview {
  overflow-x: auto;
  border-radius: 8px;
  background: #f0f2f5;
  padding: 20px;
}

.salary-slip-template,
.salary-slip-template * {
  box-sizing: border-box;
}

.salary-slip-template {
  --primary-slip: #1e3a8a;
  --primary-slip-light: #3b82f6;
  --accent-slip-light: #eef2ff;
  --text-slip-dark: #1a202c;
  --text-slip-medium: #4a5568;
  --text-slip-light: #718096;
  --border-slip: #e2e8f0;
  --border-slip-dark: #cbd5e0;
  --bg-slip-light: #f7fafc;
  --bg-slip-white: #ffffff;
  --success-slip: #38a169;
  width: 210mm;
  height: 148mm;
  min-height: 148mm;
  margin: 0 auto;
  overflow: hidden;
  position: relative;
  background: var(--bg-slip-white);
  box-shadow: 0 4px 24px rgba(30, 58, 138, 0.14);
  color: var(--text-slip-dark);
  font-family: Poppins, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.salary-slip-template .salary-slip {
  width: 100%;
  height: 148mm;
  overflow: hidden;
  position: relative;
  padding: 5mm 7mm 4mm;
}

.salary-slip-template .blank-half {
  display: none;
}

.salary-slip-template .cut-line-label {
  display: none;
}

.salary-slip-template .watermark {
  position: absolute;
  z-index: 0;
  top: 50%;
  left: 50%;
  width: 220px;
  height: 220px;
  opacity: 0.04;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.salary-slip-template .watermark img,
.salary-slip-template .logo-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.salary-slip-template .slip-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 2px solid var(--primary-slip);
  padding-bottom: 8px;
}

.salary-slip-template .logo-container {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  overflow: hidden;
  border: 1.5px solid var(--border-slip);
  border-radius: 50%;
  background: #fff;
}

.salary-slip-template .header-info {
  flex: 1;
}

.salary-slip-template .school-name {
  color: var(--primary-slip);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1.2;
  text-transform: uppercase;
}

.salary-slip-template .school-address {
  margin-top: 2px;
  color: var(--text-slip-medium);
  font-size: 8.5px;
  font-weight: 400;
}

.salary-slip-template .school-affiliation {
  margin-top: 1px;
  color: var(--text-slip-medium);
  font-size: 7px;
}

.salary-slip-template .slip-title-block {
  flex-shrink: 0;
  text-align: right;
}

.salary-slip-template .slip-title {
  color: var(--primary-slip);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.salary-slip-template .slip-meta {
  margin-top: 3px;
  color: var(--text-slip-light);
  font-size: 8px;
}

.salary-slip-template .slip-meta span {
  display: block;
}

.salary-slip-template .employee-section {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  border: 1px solid #dbe9f7;
  border-radius: 4px;
  background: var(--accent-slip-light);
  padding: 7px 10px;
}

.salary-slip-template .employee-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px 20px;
}

.salary-slip-template .emp-field {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.salary-slip-template .emp-label {
  flex-shrink: 0;
  color: var(--text-slip-light);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  white-space: nowrap;
}

.salary-slip-template .emp-value {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-slip-dark);
  font-size: 9.5px;
  font-weight: 600;
}

.salary-slip-template .financials {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid var(--border-slip);
  border-radius: 4px;
}

.salary-slip-template .fin-column {
  min-height: 0;
}

.salary-slip-template .fin-column:first-child {
  border-right: 1px solid var(--border-slip);
}

.salary-slip-template .fin-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-slip);
  padding: 5px 10px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.salary-slip-template .earnings-header {
  background: #f0fff4;
  color: #276749;
}

.salary-slip-template .deductions-header {
  background: #fff5f5;
  color: #9b2c2c;
}

.salary-slip-template .fin-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #f7fafc;
  padding: 4px 10px;
  font-size: 9px;
}

.salary-slip-template .fin-row:last-child {
  border-bottom: none;
}

.salary-slip-template .fin-row-label {
  min-width: 0;
  flex: 1;
  color: var(--text-slip-medium);
  font-weight: 400;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.salary-slip-template .fin-row-value {
  flex: 0 0 22mm;
  margin-left: 5px;
  color: var(--text-slip-dark);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}

.salary-slip-template .attendance-note {
  position: relative;
  z-index: 1;
  border-bottom: 1px solid #edf2f7;
  padding: 3px 10px;
  color: var(--text-slip-light);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.35px;
  line-height: 1.2;
  text-transform: uppercase;
}

.salary-slip-template .actual-deduction-note {
  color: #9b2c2c;
}

.salary-slip-template .salary-calculation-summary {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 2px;
  margin-top: 4px;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  background: #eef2ff;
  padding: 4px 7px;
  color: #3730a3;
  font-size: 7px;
  line-height: 1.25;
}

.salary-slip-template .fin-total-row {
  display: flex;
  justify-content: space-between;
  border-top: 1.5px solid var(--border-slip-dark);
  background: var(--bg-slip-light);
  padding: 5px 10px;
  font-size: 9.5px;
  font-weight: 700;
}

.salary-slip-template .total-earnings {
  color: #276749;
}

.salary-slip-template .total-deductions {
  color: #9b2c2c;
}

.salary-slip-template .balance-after-deductions {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  margin-top: 7px;
  border: 1px solid var(--border-slip);
  border-radius: 4px;
  background: #f8fafc;
  padding: 5px 10px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.salary-slip-template .balance-positive {
  color: #1a365d;
}

.salary-slip-template .balance-negative {
  border-color: #fed7d7;
  background: #fff5f5;
  color: #9b2c2c;
}

.salary-slip-template .net-salary-section {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  border-radius: 4px;
  background: var(--primary-slip);
  padding: 7px 12px;
}

.salary-slip-template .net-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.salary-slip-template .net-amount {
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.salary-slip-template .net-words {
  margin-top: 1px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 7.5px;
  font-style: italic;
}

.salary-slip-template .remarks-section {
  position: relative;
  z-index: 1;
  margin-top: 6px;
}

.salary-slip-template .remarks-label {
  margin-bottom: 2px;
  color: var(--text-slip-light);
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.salary-slip-template .remarks-text {
  min-height: 12px;
  border-bottom: 1px solid var(--border-slip);
  padding: 3px 0;
  color: var(--text-slip-medium);
  font-size: 8px;
}

.salary-slip-template .slip-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8px;
}

.salary-slip-template .footer-left {
  display: flex;
  gap: 16px;
}

.salary-slip-template .footer-field {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.salary-slip-template .footer-label {
  color: var(--text-slip-light);
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.salary-slip-template .footer-value {
  color: var(--text-slip-dark);
  font-size: 9px;
  font-weight: 600;
}

.salary-slip-template .status-paid,
.salary-slip-template .status-pending {
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 8px;
  font-weight: 700;
}

.salary-slip-template .status-paid {
  border: 1px solid #c6f6d5;
  background: #f0fff4;
  color: var(--success-slip);
}

.salary-slip-template .status-pending {
  border: 1px solid #fefcbf;
  background: #fffff0;
  color: #d69e2e;
}

.salary-slip-template .signature-block {
  text-align: center;
}

.salary-slip-template .signature-line {
  width: 100px;
  margin-bottom: 2px;
  border-top: 1px solid var(--text-slip-medium);
}

.salary-slip-template .signature-label {
  color: var(--text-slip-light);
  font-size: 7px;
  font-weight: 500;
}

.salary-slip-template .stamp-signature-wrap {
  position: relative;
  text-align: center;
}

.salary-slip-template .signature-img {
  display: block;
  width: 80px;
  height: auto;
  margin: 0 auto -8px;
  opacity: 0.85;
}

.salary-slip-template .stamp-img {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 50%;
  width: 60px;
  height: 60px;
  object-fit: contain;
  opacity: 0.7;
  transform: translateX(-50%);
}

.salary-slip-template .pay-mode-toggle {
  display: inline-flex;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border-slip);
  border-radius: 4px;
}

.salary-slip-template .pay-mode-printed {
  display: none;
}

.salary-slip-template .mode-btn {
  border: 0;
  background: var(--bg-slip-light);
  color: var(--text-slip-light);
  cursor: pointer;
  padding: 3px 8px;
  font-family: Inter, sans-serif;
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.salary-slip-template .mode-btn:first-child {
  border-right: 1px solid var(--border-slip);
}

.salary-slip-template .mode-btn:hover {
  background: #e2e8f0;
}

.salary-slip-template .mode-btn.active {
  background: var(--primary-slip);
  color: #fff;
}

.salary-slip-template .system-note {
  position: relative;
  z-index: 1;
  margin-top: 6px;
  color: var(--text-slip-light);
  font-size: 6.5px;
  font-style: italic;
  text-align: center;
}

/* Keep the screen preview and downloaded PDF at the same compact A5 scale. */
.salary-slip-template.a5-compact .salary-slip {
  padding: 3.5mm 5mm 2.5mm;
}

.salary-slip-template.a5-compact .slip-header {
  gap: 8px;
  padding-bottom: 4px;
}

.salary-slip-template.a5-compact .logo-container {
  width: 38px;
  height: 38px;
}

.salary-slip-template.a5-compact .school-name {
  font-size: 13px;
}

.salary-slip-template.a5-compact .school-address {
  font-size: 7.5px;
}

.salary-slip-template.a5-compact .school-affiliation {
  font-size: 6px;
}

.salary-slip-template.a5-compact .slip-title {
  font-size: 11px;
}

.salary-slip-template.a5-compact .slip-meta {
  font-size: 6.5px;
}

.salary-slip-template.a5-compact .employee-section {
  margin-top: 4px;
  padding: 4px 7px;
}

.salary-slip-template.a5-compact .employee-grid {
  gap: 2px 10px;
}

.salary-slip-template.a5-compact .emp-label {
  font-size: 6.5px;
}

.salary-slip-template.a5-compact .emp-value {
  font-size: 7.5px;
}

.salary-slip-template.a5-compact .financials {
  margin-top: 4px;
}

.salary-slip-template.a5-compact .fin-header {
  padding: 3px 6px;
  font-size: 7px;
  letter-spacing: 0.55px;
}

.salary-slip-template.a5-compact .fin-row {
  align-items: flex-start;
  padding: 2px 6px;
  font-size: 8px;
  line-height: 1.15;
}

.salary-slip-template.a5-compact .fin-row-value {
  flex-basis: 19mm;
  margin-left: 3px;
}

.salary-slip-template.a5-compact .fin-total-row {
  padding: 3px 6px;
  font-size: 8px;
}

.salary-slip-template.a5-compact .attendance-note {
  padding: 2px 6px;
  font-size: 6px;
}

.salary-slip-template.a5-compact .salary-calculation-summary {
  gap: 1px;
  margin-top: 3px;
  padding: 3px 6px;
  font-size: 7px;
  line-height: 1.15;
}

.salary-slip-template.a5-compact .balance-after-deductions {
  margin-top: 4px;
  padding: 3px 7px;
  font-size: 7px;
}

.salary-slip-template.a5-compact .net-salary-section {
  margin-top: 4px;
  padding: 4px 8px;
}

.salary-slip-template.a5-compact .net-label {
  font-size: 8px;
  letter-spacing: 0.7px;
}

.salary-slip-template.a5-compact .net-amount {
  font-size: 13px;
}

.salary-slip-template.a5-compact .net-words {
  font-size: 6px;
}

.salary-slip-template.a5-compact .remarks-section {
  margin-top: 3px;
}

.salary-slip-template.a5-compact .remarks-label,
.salary-slip-template.a5-compact .remarks-text {
  font-size: 6px;
}

.salary-slip-template.a5-compact .remarks-text {
  min-height: 0;
  padding: 1px 0;
}

.salary-slip-template.a5-compact .slip-footer {
  margin-top: 4px;
}

.salary-slip-template.a5-compact .footer-left {
  gap: 10px;
}

.salary-slip-template.a5-compact .footer-label {
  font-size: 6px;
}

.salary-slip-template.a5-compact .footer-value {
  font-size: 7px;
}

.salary-slip-template.a5-compact .signature-img,
.salary-slip-template.a5-compact .stamp-img {
  display: none;
}

.salary-slip-template.a5-compact .signature-line {
  width: 70px;
}

.salary-slip-template.a5-compact .signature-label {
  font-size: 6px;
}

.salary-slip-template.a5-compact .system-note {
  margin-top: 3px;
  font-size: 5.5px;
}

@media (max-width: 900px) {
  .salary-slip-preview {
    padding: 12px;
  }

  .salary-slip-template {
    transform-origin: top left;
  }
}

@media print {
  @page {
    size: A5 landscape;
    margin: 0;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  body * {
    visibility: hidden !important;
  }

  .salary-slip-screen,
  .salary-slip-screen * {
    visibility: visible !important;
  }

  .salary-slip-screen {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  .salary-slip-preview {
    overflow: visible !important;
    padding: 0 !important;
    border-radius: 0 !important;
    background: #fff !important;
  }

  .salary-slip-screen .no-print {
    display: none !important;
    visibility: hidden !important;
  }

  .salary-slip-template {
    width: 210mm !important;
    height: 148mm !important;
    min-height: 148mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    page-break-after: avoid;
    break-after: avoid-page;
  }

  .salary-slip-template .salary-slip {
    height: 148mm !important;
    padding: 3.5mm 5mm 2.5mm !important;
  }

  .salary-slip-template .blank-half {
    display: none !important;
  }

  .salary-slip-template .slip-header {
    gap: 8px;
    padding-bottom: 4px;
  }

  .salary-slip-template .logo-container {
    width: 38px;
    height: 38px;
  }

  .salary-slip-template .school-name {
    font-size: 13px;
  }

  .salary-slip-template .school-address {
    font-size: 7.5px;
  }

  .salary-slip-template .school-affiliation {
    font-size: 6px;
  }

  .salary-slip-template .slip-title {
    font-size: 11px;
  }

  .salary-slip-template .slip-meta {
    font-size: 6.5px;
  }

  .salary-slip-template .employee-section {
    margin-top: 4px;
    padding: 4px 7px;
  }

  .salary-slip-template .employee-grid {
    gap: 2px 10px;
  }

  .salary-slip-template .emp-label {
    font-size: 6.5px;
  }

  .salary-slip-template .emp-value {
    font-size: 7.5px;
  }

  .salary-slip-template .financials {
    margin-top: 4px;
  }

  .salary-slip-template .fin-header {
    padding: 3px 6px;
    font-size: 7px;
    letter-spacing: 0.55px;
  }

  .salary-slip-template .fin-row {
    align-items: flex-start;
    padding: 2px 6px;
    font-size: 8px;
    line-height: 1.15;
  }

  .salary-slip-template .fin-row-value {
    flex-basis: 19mm;
    margin-left: 3px;
  }

  .salary-slip-template .fin-total-row {
    padding: 3px 6px;
    font-size: 8px;
  }

  .salary-slip-template .attendance-note {
    padding: 2px 6px;
    font-size: 6px;
  }

  .salary-slip-template .salary-calculation-summary {
    gap: 1px;
    margin-top: 3px;
    padding: 3px 6px;
    font-size: 7px;
    line-height: 1.15;
  }

  .salary-slip-template .balance-after-deductions {
    margin-top: 4px;
    padding: 3px 7px;
    font-size: 7px;
  }

  .salary-slip-template .net-salary-section {
    margin-top: 4px;
    padding: 4px 8px;
  }

  .salary-slip-template .net-label {
    font-size: 8px;
    letter-spacing: 0.7px;
  }

  .salary-slip-template .net-amount {
    font-size: 13px;
  }

  .salary-slip-template .net-words {
    font-size: 6px;
  }

  .salary-slip-template .remarks-section {
    margin-top: 3px;
  }

  .salary-slip-template .remarks-label,
  .salary-slip-template .remarks-text {
    font-size: 6px;
  }

  .salary-slip-template .remarks-text {
    min-height: 0;
    padding: 1px 0;
  }

  .salary-slip-template .slip-footer {
    margin-top: 4px;
  }

  .salary-slip-template .footer-left {
    gap: 10px;
  }

  .salary-slip-template .footer-label {
    font-size: 6px;
  }

  .salary-slip-template .footer-value {
    font-size: 7px;
  }

  .salary-slip-template .signature-img,
  .salary-slip-template .stamp-img {
    display: none !important;
  }

  .salary-slip-template .signature-line {
    width: 70px;
  }

  .salary-slip-template .signature-label {
    font-size: 6px;
  }

  .salary-slip-template .system-note {
    margin-top: 3px;
    font-size: 5.5px;
  }

  .salary-slip-template .pay-mode-printed {
    display: inline !important;
  }

  .salary-slip-template .pay-mode-toggle {
    display: none !important;
  }

  .salary-slip-template .signature-img,
  .salary-slip-template .stamp-img,
  .salary-slip-template .watermark,
  .salary-slip-template .net-salary-section,
  .salary-slip-template .employee-section,
  .salary-slip-template .earnings-header,
  .salary-slip-template .deductions-header,
  .salary-slip-template .balance-after-deductions,
  .salary-slip-template .fin-total-row,
  .salary-slip-template .status-paid,
  .salary-slip-template .status-pending {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
