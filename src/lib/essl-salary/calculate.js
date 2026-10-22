// Keep the ESSL calculator rules in one place so previews and saved inputs agree.
import { getAnnualClRemaining } from "@/lib/salary";

const MONTHLY_SALARY_DAY_DIVISOR = 30;

export function getEsslPeriodEndDay(month, year, today = new Date()) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = Number(year) === today.getFullYear() && Number(month) === today.getMonth() + 1;
    return isCurrentMonth ? today.getDate() : daysInMonth;
}

export function calculateEsslSalary({ employee, month, year, records, overrides, values, annualClUsed = 0, paidSundayDates = [], previousPendingAdvance = 0, schoolExpense = 0, newAdvanceGiven = 0, lateArrivalBoundary = "08:15" }) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const periodEndDay = getEsslPeriodEndDay(month, year);
    // The employee profile is the source of truth for the monthly base salary.
    const numericBaseSalary = Math.max(0, Number(employee.baseSalary) || 0);
    const periodRecords = records.filter((record) => Number(String(record.date).slice(-2)) <= periodEndDay);
    const availableSchoolDays = periodRecords.length
        ? periodRecords.filter((record) => !record.isSunday && record.status !== "Holiday").length
        : Array.from({ length: periodEndDay }, (_, index) => new Date(year, month - 1, index + 1))
            .filter((date) => date.getDay() !== 0).length;
    const enteredWorkingDays = Number(values.workingDays);
    const regularWorkingDayLimit = Math.min(30, Math.max(1, Number.isFinite(enteredWorkingDays) && enteredWorkingDays > 0 ? enteredWorkingDays : availableSchoolDays));
    // All ESSL payrolls use a fixed 30-day salary divisor; school days only determine payable attendance.
    const dailyRate = numericBaseSalary / MONTHLY_SALARY_DAY_DIVISOR;
    const category = `${employee.role || ""} ${employee.department || ""}`.toLowerCase();
    const clLimit = category.includes("engineer") || category.includes("office") || category.includes("supervisor") || category.includes("admin") ? 2 : 0;
    const annualClRemaining = getAnnualClRemaining(annualClUsed);
    const monthlyClAllowance = Math.min(clLimit, annualClRemaining);
    const emergencyLeave = Math.max(0, Number(values.emergencyLeave) || 0);
    const earnedDays = [];
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let paidEmergencyLeaveDays = 0;
    let unpaidClDays = 0;
    let coveredAbsentDays = 0;
    let paidSundays = 0;
    let paidHolidays = 0;
    let countedPayrollDays = 0;
    let countedRegularWorkingDays = 0;
    let attendanceWorkingDays = 0;
    let fullClDaysUsed = 0;
    let halfClDaysUsed = 0;

    for (let day = 1; day <= periodEndDay; day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const source = records.find((item) => item.date === date);
        const isSunday = source?.isSunday ?? new Date(year, month - 1, day).getDay() === 0;
        const hasManualOverride = Object.prototype.hasOwnProperty.call(overrides, date);
        let status = overrides[date] || source?.status || (isSunday ? "Sunday" : "Absent");
        const isHoliday = !isSunday && status === "Holiday";
        const sundaySelected = isSunday && paidSundayDates.includes(date);
        const canCountDay = countedPayrollDays < 30;
        const isPaidHoliday = isHoliday && canCountDay;
        const isPaidSunday = sundaySelected && canCountDay;
        const isWorking = !isSunday && !isHoliday && canCountDay && countedRegularWorkingDays < regularWorkingDayLimit;
        if (isPaidHoliday || isPaidSunday || isWorking) countedPayrollDays += 1;
        if (isWorking) countedRegularWorkingDays += 1;
        if (isPaidHoliday) paidHolidays += 1;
        if (isPaidSunday) paidSundays += 1;
        let earnsDay = false;
        let isClApplied = false;
        let isHalfClApplied = false;

        // Automatically cover machine-recorded absence/half-days with remaining CL.
        // An explicit dropdown choice is respected: plain Absent/Half Day opts out,
        // while CL Absent/CL Half Day requests CL directly.
        if (isWorking && !hasManualOverride) {
            const clAlreadyUsed = fullClDaysUsed + halfClDaysUsed / 2;
            if (status === "Absent" && clAlreadyUsed + 1 <= monthlyClAllowance) {
                status = "CL Absent";
            } else if (status === "Half Day" && clAlreadyUsed + 0.5 <= monthlyClAllowance) {
                status = "CL Half Day";
            }
        }

        if (isWorking) {
            attendanceWorkingDays += 1;
            if (status === "Present") {
                presentDays += 1;
                earnsDay = true;
            } else if (status === "Half Day" || status === "CL Half Day") {
                halfDays += 1;
                earnsDay = true;
                // Half-day CL is consumed for auto-covered machine attendance or an explicit CL Half Day choice.
                if (status === "CL Half Day" && fullClDaysUsed + (halfClDaysUsed + 1) / 2 <= monthlyClAllowance) {
                    halfClDaysUsed += 1;
                    isHalfClApplied = true;
                }
            } else if (status === "CL" || status === "CL Absent") {
                const isExplicitClAbsence = status === "CL Absent";
                if (isExplicitClAbsence) absentDays += 1;
                earnsDay = fullClDaysUsed + halfClDaysUsed / 2 + 1 <= monthlyClAllowance;
                if (earnsDay) {
                    fullClDaysUsed += 1;
                    if (isExplicitClAbsence) coveredAbsentDays += 1;
                    isClApplied = true;
                } else if (!isExplicitClAbsence) unpaidClDays += 1;
            } else if (status === "Emergency Leave") {
                const emergencyLeaveAvailable = Math.max(0, emergencyLeave - paidEmergencyLeaveDays);
                const paidEmergencyLeave = Math.min(1, emergencyLeaveAvailable);
                paidEmergencyLeaveDays += paidEmergencyLeave;
                absentDays += 1;
                earnsDay = paidEmergencyLeave > 0;
            } else {
                absentDays += 1;
                // Plain Absent is unpaid. CL is used only through the explicit CL Absent option.
            }
        }

        // Sundays are always excluded from automatic salary; the user may add Sunday pay manually.
        earnedDays.push({ date, status, isSunday, isWorking, earnsDay, isClApplied, isHalfClApplied, isPaidHoliday, isPaidSunday });
    }

    const paidAttendanceDays = presentDays + halfDays / 2 + paidEmergencyLeaveDays;
    const paidWorkingDays = Math.min(30, paidAttendanceDays + fullClDaysUsed + halfClDaysUsed / 2 + paidHolidays + paidSundays);
    const workingDayCount = Math.min(30, Math.max(1, regularWorkingDayLimit + paidHolidays + paidSundays));
    const currentDate = new Date();
    const isCompletedPayrollMonth = Number(year) < currentDate.getFullYear()
        || (Number(year) === currentDate.getFullYear() && Number(month) < currentDate.getMonth() + 1);
    const hasFullAttendance = isCompletedPayrollMonth
        && attendanceWorkingDays === regularWorkingDayLimit
        && regularWorkingDayLimit > 0
        && presentDays === attendanceWorkingDays
        && halfDays === 0
        && absentDays === 0
        && fullClDaysUsed === 0
        && halfClDaysUsed === 0
        && emergencyLeave === 0;
    const [lateHour, lateMinute] = String(lateArrivalBoundary).split(":").map(Number);
    const lateBoundaryMinutes = Number.isFinite(lateHour) && Number.isFinite(lateMinute) ? lateHour * 60 + lateMinute : 8 * 60 + 15;
    const lateArrivalDays = records.filter((record) => {
        const date = String(record.date || "");
        const day = Number(date.slice(-2));
        const arrival = String(record.punches?.[0] || "").split(":").map(Number);
        if (date.slice(0, 7) !== `${year}-${String(month).padStart(2, "0")}` || day > periodEndDay || !record.punches?.length || record.isSunday || record.status === "Holiday") return false;
        const arrivalMinutes = arrival[0] * 60 + arrival[1];
        return Number.isFinite(arrivalMinutes) && arrivalMinutes > lateBoundaryMinutes;
    }).map((record) => ({ date: record.date, time: record.punches[0] }));
    const lateArrivalBonusDisqualified = lateArrivalDays.length > 3;
    const bonusClUsed = hasFullAttendance && !lateArrivalBonusDisqualified && monthlyClAllowance >= 1 ? 1 : 0;
    const clTaken = fullClDaysUsed + halfClDaysUsed / 2 + bonusClUsed;
    const paidClDays = fullClDaysUsed + halfClDaysUsed / 2;
    const deductibleHalfDays = Math.max(0, halfDays - halfClDaysUsed);
    const halfDayDeduction = roundAmount(dailyRate * deductibleHalfDays / 2);
    const unpaidAbsenceDays = Math.max(0, absentDays - coveredAbsentDays - paidEmergencyLeaveDays) + unpaidClDays;
    const absenceDeduction = roundAmount(dailyRate * unpaidAbsenceDays);
    const workedDaysSalary = roundAmount(dailyRate * (presentDays + halfDays / 2));
    const clSalary = roundAmount(dailyRate * fullClDaysUsed);
    const clHalfSalary = roundAmount(dailyRate * halfClDaysUsed / 2);
    const emergencyLeaveSalary = roundAmount(dailyRate * paidEmergencyLeaveDays);
    const earnedSalary = workedDaysSalary;
    const sundayPay = roundAmount(dailyRate * paidSundays);
    const holidayPay = roundAmount(dailyRate * paidHolidays);
    const bonusInput = Math.max(0, Number(values.bonus) || 0);
    const fullAttendanceBonus = bonusClUsed ? dailyRate : 0;
    const bonus = roundAmount(bonusInput + fullAttendanceBonus);
    const normalizedPreviousAdvance = Math.max(0, Number(previousPendingAdvance) || 0);
    const normalizedSchoolExpense = Math.max(0, Number(schoolExpense) || 0);
    const normalizedNewAdvance = Math.max(0, Number(newAdvanceGiven) || 0);
    const advancePool = roundAmount(normalizedPreviousAdvance + normalizedSchoolExpense + normalizedNewAdvance);
    const requestedAdvanceDeduction = roundAmount(Math.min(Math.max(0, Number(values.advanceDeduction) || 0), advancePool));
    const pfAmount = roundAmount(Math.max(0, Number(values.pfAmount) || 0));
    // Salary is built from paid attendance and paid leave units. Unpaid
    // attendance is already excluded here, so its value must not be deducted again.
    const paidLeaveSalary = roundAmount(clSalary + clHalfSalary);
    const baseSalaryEarnings = roundAmount(workedDaysSalary + paidLeaveSalary + emergencyLeaveSalary);
    const additionalEarnings = roundAmount(sundayPay + holidayPay + bonus);
    const attendanceDeductions = roundAmount(absenceDeduction + halfDayDeduction);
    const gross = roundAmount(baseSalaryEarnings + additionalEarnings);
    const advanceRecoveryCapacity = Math.max(0, gross - pfAmount);
    const advanceDeduction = roundAmount(Math.min(requestedAdvanceDeduction, advanceRecoveryCapacity));
    const otherDeductions = roundAmount(advanceDeduction + pfAmount);
    const deductions = otherDeductions;
    const actualAdvanceRecovered = advanceDeduction;

    return {
        daysInMonth,
        periodEndDay,
        dailyRate,
        clLimit,
        annualClUsed: Math.max(0, Number(annualClUsed) || 0),
        annualClRemaining: getAnnualClRemaining(Number(annualClUsed) + clTaken),
        clTaken,
        bonusClUsed,
        lateArrivalDays,
        lateArrivalBoundary,
        lateArrivalBonusDisqualified,
        fullClDaysUsed,
        halfClDaysUsed,
        presentDays,
        halfDays,
        absentDays,
        workingDayCount,
        attendanceWorkingDays,
        paidWorkingDays,
        workedDays: presentDays + halfDays / 2,
        paidClDays,
        paidSundays,
        paidHolidays,
        paidAttendanceDays,
        earnedSalary,
        workedDaysSalary,
        paidLeaveSalary,
        clSalary,
        clHalfSalary,
        paidEmergencyLeaveDays,
        emergencyLeaveSalary,
        sundayPay,
        holidayPay,
        halfDayDeduction,
        deductibleHalfDays,
        unpaidAbsenceDays,
        absenceDeduction,
        bonusInput,
        fullAttendanceBonus,
        bonus,
        previousPendingAdvance: normalizedPreviousAdvance,
        schoolExpense: normalizedSchoolExpense,
        newAdvanceGiven: normalizedNewAdvance,
        advancePool,
        requestedAdvanceDeduction,
        advanceDeduction,
        actualAdvanceRecovered,
        remainingAdvance: Math.max(0, advancePool - actualAdvanceRecovered),
        pfAmount,
        gross,
        deductions,
        baseSalaryEarnings,
        additionalEarnings,
        attendanceDeductions,
        otherDeductions,
        payable: Math.max(0, roundAmount(gross - deductions)),
        earnedDays
    };
}

function roundAmount(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function currency(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
}
