import { toNumber } from "@/lib/utils";
export const ANNUAL_CL_ALLOWANCE = 14;
export const MAX_CL_PER_REQUEST = 2;
const MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];
export function getMonthlyClAllowance(month) {
    normalizeMonth(month);
    return MAX_CL_PER_REQUEST;
}
export function getAnnualClRemaining(annualClUsed = 0) {
    return Math.max(ANNUAL_CL_ALLOWANCE - Math.max(toNumber(annualClUsed), 0), 0);
}
export function getAllowedClUsedForSalary(salary) {
    return getEquivalentClUsed({
        casualLeave: salary?.casualLeave,
        halfCLTaken: salary?.halfCLTaken
    });
}
export function sumAllowedClUsed(salaries = []) {
    return salaries.reduce((sum, salary) => sum + getAllowedClUsedForSalary(salary), 0);
}
export function getEquivalentClUsed(input = {}) {
    const fullCLTaken = Math.max(toNumber(input.casualLeave ?? input.fullCLTaken), 0);
    const halfCLTaken = Math.max(toNumber(input.halfCLTaken), 0);
    return round(fullCLTaken + halfCLTaken / 2);
}
export function getLeaveSummary({ pastFullCL = 0, pastHalfCL = 0, casualLeave = 0, halfCLTaken = 0, totalCL = ANNUAL_CL_ALLOWANCE } = {}) {
    const fullCLTaken = Math.max(toNumber(casualLeave), 0) + Math.max(toNumber(pastFullCL), 0);
    const halfDays = Math.max(toNumber(halfCLTaken), 0) + Math.max(toNumber(pastHalfCL), 0);
    const equivalentCLUsed = getEquivalentClUsed({ casualLeave: fullCLTaken, halfCLTaken: halfDays });
    
    return {
        totalCL: round(Math.max(toNumber(totalCL, ANNUAL_CL_ALLOWANCE), 0)),
        fullCLTaken: round(fullCLTaken),
        halfCLTaken: round(halfDays),
        equivalentCLUsed,
        yearlyCLUsed: equivalentCLUsed,
        remainingCL: round(Math.max(Math.max(toNumber(totalCL, ANNUAL_CL_ALLOWANCE), 0) - equivalentCLUsed, 0))
    };
}
export function getAttendanceStats(input = {}) {
    const workingDays = Math.max(toNumber(input.workingDays), 0);
    const daysPresent = Math.min(Math.max(toNumber(input.daysPresent), 0), workingDays);
    const percentage = workingDays > 0 ? (daysPresent / workingDays) * 100 : 0;
    return {
        daysPresent: round(daysPresent),
        workingDays: round(workingDays),
        percentage: round(percentage)
    };
}
export function getAttendanceSummary(records = []) {
    const totals = records.reduce((acc, record) => {
        const stats = getAttendanceStats(record);
        if (stats.workingDays <= 0)
            return acc;
        acc.daysPresent += stats.daysPresent;
        acc.workingDays += stats.workingDays;
        return acc;
    }, { daysPresent: 0, workingDays: 0 });
    return getAttendanceStats(totals);
}
export function validateClRequest({ casualLeave = 0, halfCLTaken = 0, annualClUsed = 0, totalCL = ANNUAL_CL_ALLOWANCE } = {}) {
    const fullCLTaken = Math.max(toNumber(casualLeave), 0);
    const halfDays = Math.max(toNumber(halfCLTaken), 0);
    const equivalentCLUsed = getEquivalentClUsed({ casualLeave: fullCLTaken, halfCLTaken: halfDays });
    const remaining = getAnnualClRemaining(annualClUsed);
    if (fullCLTaken > MAX_CL_PER_REQUEST) {
        return `Full CL cannot be more than ${MAX_CL_PER_REQUEST} days in one request.`;
    }
    if (equivalentCLUsed > remaining || annualClUsed + equivalentCLUsed > totalCL) {
        return `Annual CL limit exceeded. Remaining CL is ${remaining}.`;
    }
    return "";
}
export function getClPolicyMessage(month, annualClUsed = 0) {
    const monthNumber = normalizeMonth(month);
    const annualRemaining = getAnnualClRemaining(annualClUsed);
    if (annualRemaining <= 0)
        return "Annual CL limit reached. Any CL entered now will be deducted.";
    return `${MONTH_NAMES[monthNumber]} allows up to ${MAX_CL_PER_REQUEST} CL in one request. Annual CL remaining: ${annualRemaining}/${ANNUAL_CL_ALLOWANCE}.`;
}
export function calculateSalary(input) {
    const baseSalary = Math.max(toNumber(input.baseSalary), 0);
    const workingDays = Math.max(toNumber(input.workingDays), 1);
    const daysPresent = Math.max(toNumber(input.daysPresent), 0);
    const deductionDaysPresent = Math.min(daysPresent, workingDays);
    const casualLeave = Math.max(toNumber(input.casualLeave), 0);
    const halfCLTaken = Math.max(toNumber(input.halfCLTaken), 0);
    const excessCL = Math.max(toNumber(input.excessCL), 0);
    const emergencyLeave = Math.max(toNumber(input.emergencyLeave), 0);
    const bonus = Math.max(toNumber(input.bonus), 0);
    const advanceGiven = Math.max(toNumber(input.advanceGiven), 0);
    const previousPendingAdvance = Math.max(toNumber(input.previousPendingAdvance), 0);
    const advanceDeduction = Math.max(toNumber(input.advanceDeduction), 0);
    const ledgerDeduction = Math.max(toNumber(input.ledgerDeduction), 0);
    const pfAmount = Math.max(toNumber(input.pfAmount), 0);
    const totalPendingAdvance = previousPendingAdvance + ledgerDeduction + advanceGiven;
    const clampedAdvanceDeduction = Math.min(advanceDeduction, totalPendingAdvance);
    const monthlyClAllowance = MAX_CL_PER_REQUEST;
    const annualClRemaining = getAnnualClRemaining(input.annualClUsed);
    const requestedEquivalentCL = getEquivalentClUsed({ casualLeave, halfCLTaken });
    // clAllowance uses equivalent CL (full + half/2) so half-day leave is counted
    const clAllowance = Math.min(requestedEquivalentCL, monthlyClAllowance, annualClRemaining);
    // Extra present days are allowed for records, but deductions never go below zero.
    const absentDays = Math.max(workingDays - deductionDaysPresent, 0);
    const perDaySalary = baseSalary / workingDays;
    // Deductible absences: total absent - allowed CL (equiv) - excess CL adjustment - emergency leave.
    const allowedClUsed = Math.min(requestedEquivalentCL, clAllowance);
    const remainingAfterAllowedLeave = Math.max(absentDays - allowedClUsed - emergencyLeave, 0);
    const excessCLAdjusted = Math.min(excessCL, remainingAfterAllowedLeave);
    const deductibleAbsence = Math.max(remainingAfterAllowedLeave - excessCLAdjusted, 0);
    const absenceDeduction = deductibleAbsence * perDaySalary;
    const excessCLDeduction = 0;

    const totalEarnings = baseSalary + bonus;
    
    // Box 12 is the single recovery amount for previous advance + school expense + new advance.
    const totalDeduction = absenceDeduction + excessCLDeduction + clampedAdvanceDeduction + pfAmount;
    const balanceAfterDeductions = totalEarnings - totalDeduction;
    const payableSalary = Math.max(balanceAfterDeductions, 0);

    const earningsAvailableForAdvance = Math.max(totalEarnings - absenceDeduction - excessCLDeduction - pfAmount, 0);
    const actualRecovered = Math.min(clampedAdvanceDeduction, earningsAvailableForAdvance);
    const actualLedgerRecovered = ledgerDeduction;
    const remainingAdvance = Math.max(totalPendingAdvance - actualRecovered, 0);

    return {
        clAllowance: round(clAllowance),
        monthlyClAllowance: round(monthlyClAllowance),
        annualClRemaining: round(annualClRemaining),
        annualClLimit: ANNUAL_CL_ALLOWANCE,
        fullCLTaken: round(casualLeave),
        halfCLTaken: round(halfCLTaken),
        equivalentCLUsed: round(requestedEquivalentCL),
        remainingCL: round(Math.max(ANNUAL_CL_ALLOWANCE - Math.max(toNumber(input.annualClUsed), 0) - requestedEquivalentCL, 0)),
        absentDays: round(absentDays),
        excessCL: round(excessCL),
        excessCLAdjusted: round(excessCLAdjusted),
        perDaySalary: round(perDaySalary),
        emergencyLeave: round(emergencyLeave),
        deductibleAbsence: round(deductibleAbsence),
        absenceDeduction: round(absenceDeduction),
        excessCLDeduction: round(excessCLDeduction),
        pfAmount: round(pfAmount),
        advanceGiven: round(advanceGiven),
        previousPendingAdvance: round(previousPendingAdvance),
        advanceDeduction: round(clampedAdvanceDeduction),
        ledgerDeduction: round(ledgerDeduction),
        actualLedgerDeduction: round(actualLedgerRecovered),
        remainingLedgerDeduction: 0,
        remainingAdvance: round(remainingAdvance),
        totalDeduction: round(totalDeduction),
        totalEarnings: round(totalEarnings),
        balanceAfterDeductions: round(balanceAfterDeductions),
        netSalary: round(payableSalary),
        payableSalary: round(payableSalary)
    };
}
function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function normalizeMonth(month) {
    const monthNumber = Math.trunc(toNumber(month, new Date().getMonth() + 1));
    if (monthNumber < 1)
        return 1;
    if (monthNumber > 12)
        return 12;
    return monthNumber;
}
