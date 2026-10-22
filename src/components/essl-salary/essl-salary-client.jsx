"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { calculateEsslSalary, currency, getEsslPeriodEndDay } from "@/lib/essl-salary/calculate";
import { createEsslSalaryNote, parseEsslSalaryNote } from "@/lib/essl-salary/report-data";
import { ANNUAL_CL_ALLOWANCE, sumAllowedClUsed } from "@/lib/salary";
import { Calculator, CalendarDays, Check, RefreshCw, Save, Users, AlertCircle, Sparkles, TrendingUp, IndianRupee, X } from "lucide-react";

const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Date(2020, index, 1).toLocaleDateString("en-IN", { month: "long" }) }));
const statusOptions = ["Present", "Half Day", "Absent", "CL Absent", "CL Half Day", "Emergency Leave", "Holiday"];

export function EsslSalaryClient() {
    const { notify } = useToast();
    const now = new Date();
    const [employees, setEmployees] = useState([]);
    const [report, setReport] = useState([]);
    const [employeeSalaries, setEmployeeSalaries] = useState([]);
    const [salaryHistoryEmployeeId, setSalaryHistoryEmployeeId] = useState("");
    const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false);
    const [salaryHistoryError, setSalaryHistoryError] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
    const [employeeMenuRect, setEmployeeMenuRect] = useState(null);
    const employeeSearchRef = useRef(null);
    const employeeMenuRef = useRef(null);
    const [month, setMonth] = useState(now.getMonth() + 1);
    const year = 2026;
    const [holidays, setHolidays] = useState("");
    const [holidayDirty, setHolidayDirty] = useState(false);
    const [loadedHolidayKey, setLoadedHolidayKey] = useState("");
    const [holidaySaveStatus, setHolidaySaveStatus] = useState("Loading…");
    const holidayValueRef = useRef("");
    const [overrides, setOverrides] = useState({});
    const [paidSundayDates, setPaidSundayDates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastMachineSync, setLastMachineSync] = useState(null);
    const [latestMachinePunch, setLatestMachinePunch] = useState(null);
    const [attendanceSnapshotStale, setAttendanceSnapshotStale] = useState(false);
    const [attendanceSnapshotSaved, setAttendanceSnapshotSaved] = useState(true);
    const [notes, setNotes] = useState("");
    const [lateArrivalBoundary, setLateArrivalBoundary] = useState("07:30");
    const [values, setValues] = useState({ workingDays: 0, clTaken: 0, emergencyLeave: 0, bonus: 0, advanceDeduction: 0, pfAmount: 0 });
    const [advanceData, setAdvanceData] = useState({ previousPendingAdvance: 0, schoolExpense: 0, newAdvanceGiven: 0 });
    const [advanceLoading, setAdvanceLoading] = useState(false);
    const [advanceLoadError, setAdvanceLoadError] = useState("");

    async function loadEmployees() {
        const response = await fetch("/api/employees?status=Active", { cache: "no-store" });
        const data = response.ok ? await response.json() : { employees: [] };
        setEmployees(data.employees || []);
    }

    async function syncAttendance() {
        setLoading(true);
        try {
            const response = await fetch(`/api/essl/report?month=${month}&year=${year}&branch=All&holidays=${encodeURIComponent(holidays)}`, { cache: "no-store" });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Could not read eSSL attendance");
            setReport(data.report || []);
            setLastMachineSync(data.lastSyncedAt || null);
            setLatestMachinePunch(data.latestPunch || data.diagnostics?.latestPunch || null);
            setAttendanceSnapshotStale(Boolean(data.stale));
            setAttendanceSnapshotSaved(data.snapshotSaved !== false);
            if (data.stale) {
                notify({ tone: "info", title: `Showing saved attendance · last machine sync ${data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString("en-IN") : "unknown"}` });
            } else if (data.snapshotSaved === false) {
                notify({ tone: "error", title: "Attendance loaded, but Supabase could not save the sync snapshot" });
            } else {
                notify({ tone: "success", title: `Attendance refreshed for ${monthOptions[month - 1].label} ${year}` });
            }
        } catch (error) {
            notify({ tone: "error", title: error.message || "Attendance sync failed" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadEmployees(); }, []);

    useEffect(() => {
        let active = true;
        fetch("/api/settings/attendance-policy", { cache: "no-store" })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => { if (active && data?.lateArrivalBoundary) setLateArrivalBoundary(data.lateArrivalBoundary); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const holidayKey = `${year}-${String(month).padStart(2, "0")}`;

    useEffect(() => {
        let active = true;
        setLoadedHolidayKey("");
        setHolidayDirty(false);
        setHolidaySaveStatus("Loading…");
        fetch(`/api/essl/holidays?month=${month}&year=${year}`, { cache: "no-store" })
            .then((response) => response.ok ? response.json() : { holidays: "" })
            .then((data) => {
                if (!active) return;
                holidayValueRef.current = data.holidays || "";
                setHolidays(data.holidays || "");
                setLoadedHolidayKey(holidayKey);
                setHolidaySaveStatus("Saved");
            })
            .catch(() => {
                if (!active) return;
                setLoadedHolidayKey(holidayKey);
                setHolidaySaveStatus("Could not load");
            });
        return () => { active = false; };
    }, [holidayKey, month, year]);

    useEffect(() => {
        if (!holidayDirty || loadedHolidayKey !== holidayKey) return undefined;
        const timer = window.setTimeout(async () => {
            setHolidaySaveStatus("Saving…");
            const savedValue = holidays;
            try {
                const response = await fetch("/api/essl/holidays", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ month, year, holidays: savedValue })
                });
                if (!response.ok) throw new Error("Could not save holiday dates");
                const stillCurrent = holidayValueRef.current === savedValue;
                if (stillCurrent) {
                    setHolidayDirty(false);
                    setHolidaySaveStatus("Saved");
                    notify({ tone: "success", title: "Holiday dates saved", description: `${monthOptions[month - 1].label} ${year}` });
                }
                try {
                    const reportResponse = await fetch(`/api/essl/report?month=${month}&year=${year}&holidays=${encodeURIComponent(savedValue)}`, { cache: "no-store" });
                    const data = await reportResponse.json();
                    if (!reportResponse.ok || !data.success) throw new Error(data.message || "Attendance could not be refreshed.");
                    setReport(data.report || []);
                    setLastMachineSync(data.lastSyncedAt || null);
                    setLatestMachinePunch(data.latestPunch || data.diagnostics?.latestPunch || null);
                    setAttendanceSnapshotStale(Boolean(data.stale));
                    setAttendanceSnapshotSaved(data.snapshotSaved !== false);
                } catch {
                    if (stillCurrent) setHolidaySaveStatus("Saved · attendance refresh failed");
                }
            } catch (error) {
                setHolidaySaveStatus("Save failed — retry by editing the dates");
                notify({ tone: "error", title: error.message || "Holiday dates could not be saved" });
            }
        }, 650);
        return () => window.clearTimeout(timer);
    }, [holidayDirty, loadedHolidayKey, holidayKey, month, year, holidays, notify]);

    useEffect(() => {
        if (loadedHolidayKey === holidayKey) syncAttendance();
    }, [loadedHolidayKey, holidayKey]);

    useEffect(() => {
        let active = true;
        if (!employeeId) {
            setEmployeeSalaries([]);
            setSalaryHistoryEmployeeId("");
            setSalaryHistoryLoading(false);
            setSalaryHistoryError("");
            return undefined;
        }

        setEmployeeSalaries([]);
        setSalaryHistoryEmployeeId("");
        const loadEmployeeSalaries = async () => {
            setSalaryHistoryLoading(true);
            setSalaryHistoryError("");
            try {
                const response = await fetch(`/api/salaries?employeeId=${encodeURIComponent(employeeId)}&year=${year}`, { cache: "no-store" });
                if (!response.ok) throw new Error("Saved salary periods could not be checked.");
                const data = await response.json();
                if (active) {
                    setEmployeeSalaries(data.salaries || []);
                    setSalaryHistoryEmployeeId(employeeId);
                }
            } catch (error) {
                if (active) setSalaryHistoryError(error.message || "Saved salary periods could not be checked.");
            } finally {
                if (active) setSalaryHistoryLoading(false);
            }
        };

        loadEmployeeSalaries();
        window.addEventListener("focus", loadEmployeeSalaries);
        return () => {
            active = false;
            window.removeEventListener("focus", loadEmployeeSalaries);
        };
    }, [employeeId, year]);

    useEffect(() => {
        let active = true;
        if (!employeeId) {
            setAdvanceData({ previousPendingAdvance: 0, schoolExpense: 0, newAdvanceGiven: 0 });
            setValues((current) => ({ ...current, advanceDeduction: 0 }));
            setAdvanceLoading(false);
            setAdvanceLoadError("");
            return undefined;
        }

        setAdvanceLoading(true);
        setAdvanceLoadError("");
        setAdvanceData({ previousPendingAdvance: 0, schoolExpense: 0, newAdvanceGiven: 0 });
        setValues((current) => ({ ...current, advanceDeduction: 0 }));
        const query = `employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`;
        Promise.all([
            fetch(`/api/salaries/advance-pending?${query}`, { cache: "no-store" }),
            fetch("/api/ledger?status=Open&fields=summary", { cache: "no-store" }),
            fetch(`/api/salaries?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`, { cache: "no-store" })
        ]).then(async ([pendingResponse, ledgerResponse, salaryResponse]) => {
            if (!pendingResponse.ok || !ledgerResponse.ok || !salaryResponse.ok) throw new Error("Advance balances could not be loaded");
            const [pendingData, ledgerData, salaryData] = await Promise.all([
                pendingResponse.json(),
                ledgerResponse.json(),
                salaryResponse.json()
            ]);
            if (!active) return;
            const currentSalary = (salaryData.salaries || []).find((salary) => Number(salary.month) === Number(month) && Number(salary.year) === Number(year));
            const savedEsslNote = parseEsslSalaryNote(currentSalary?.notes);
            const liveSchoolExpense = (ledgerData.entries || [])
                .filter((entry) => String(entry.employeeId) === String(employeeId))
                .reduce((sum, entry) => sum + (Number(entry.balanceAmount) || 0), 0);
            const schoolExpense = Number(savedEsslNote?.schoolExpense ?? currentSalary?.ledgerDeduction ?? liveSchoolExpense) || 0;
            const newAdvanceGiven = Number(savedEsslNote?.newAdvanceGiven ?? currentSalary?.advanceGiven) || 0;
            const advanceDeduction = Number(savedEsslNote?.advanceDeduction ?? currentSalary?.advanceDeduction) || 0;
            setAdvanceData({
                previousPendingAdvance: Number(pendingData.previousPendingAdvance) || 0,
                schoolExpense,
                newAdvanceGiven
            });
            setValues((current) => ({ ...current, advanceDeduction }));
        }).catch(() => {
            if (active) {
                setAdvanceData({ previousPendingAdvance: 0, schoolExpense: 0, newAdvanceGiven: 0 });
                setAdvanceLoadError("Advance balances could not be loaded. Refresh the page before saving salary.");
            }
        }).finally(() => {
            if (active) setAdvanceLoading(false);
        });
        return () => { active = false; };
    }, [employeeId, month, year]);

    const employee = employees.find((item) => item.employeeId === employeeId);
    const salaryHistoryReady = Boolean(employeeId) && salaryHistoryEmployeeId === employeeId;
    const savedSalaryMonths = useMemo(() => new Set((salaryHistoryReady ? employeeSalaries : [])
        .filter((salary) => String(salary.notes || "").includes("ESSL Calculator:"))
        .map((salary) => Number(salary.month))), [employeeSalaries, salaryHistoryReady]);
    const availableMonthOptions = useMemo(() => {
        if (!employeeId) return monthOptions;
        if (!salaryHistoryReady) return [];
        return monthOptions.filter((item) => !savedSalaryMonths.has(item.value));
    }, [employeeId, salaryHistoryReady, savedSalaryMonths]);
    const annualClUsed = useMemo(() => sumAllowedClUsed((salaryHistoryReady ? employeeSalaries : [])
        .filter((salary) => Number(salary.month) !== Number(month))), [employeeSalaries, salaryHistoryReady, month]);
    const canSavePayroll = Boolean(employee)
        && salaryHistoryReady
        && !salaryHistoryLoading
        && !salaryHistoryError
        && availableMonthOptions.some((item) => item.value === Number(month));
    useEffect(() => {
        if (!employeeId || !salaryHistoryReady || salaryHistoryLoading || salaryHistoryError || !savedSalaryMonths.has(Number(month))) return;
        const nextAvailableMonth = availableMonthOptions.find((item) => item.value > Number(month)) || availableMonthOptions[0];
        if (nextAvailableMonth) setMonth(nextAvailableMonth.value);
    }, [employeeId, salaryHistoryReady, salaryHistoryLoading, salaryHistoryError, savedSalaryMonths, availableMonthOptions, month]);
    const periodEndDay = getEsslPeriodEndDay(month, year);
    const matchingEmployees = employees.filter((item) => `${item.name} ${item.employeeId} ${item.department || item.role}`.toLowerCase().includes(employeeSearch.trim().toLowerCase()));
    const attendance = report.find((item) => item.employeeId === employeeId);
    const monthRecords = attendance?.attendanceRecord || [];

    useEffect(() => {
        setPaidSundayDates([]);
    }, [employeeId, month, year]);

    useEffect(() => {
        if (!employee) return;
        const periodRecords = monthRecords.filter((record) => Number(String(record.date).slice(-2)) <= periodEndDay);
        const workingDays = Math.min(30, periodRecords.length
            ? periodRecords.filter((record) => !record.isSunday && record.status !== "Holiday").length
            : Array.from({ length: periodEndDay }, (_, i) => new Date(year, month - 1, i + 1)).filter((date) => date.getDay() !== 0).length);
        setValues((current) => ({ ...current, workingDays }));
        setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([date]) => !date.startsWith(`${year}-${String(month).padStart(2, "0")}-`))));
    }, [employeeId, month, year, attendance, periodEndDay]);

    const calculation = useMemo(() => employee ? calculateEsslSalary({ employee, month, year, records: monthRecords, overrides, values, annualClUsed, paidSundayDates, previousPendingAdvance: advanceData.previousPendingAdvance, schoolExpense: advanceData.schoolExpense, newAdvanceGiven: advanceData.newAdvanceGiven, lateArrivalBoundary }) : null, [employee, month, year, monthRecords, overrides, values, annualClUsed, paidSundayDates, advanceData, lateArrivalBoundary]);
    const totalAdvancePool = advanceData.previousPendingAdvance + advanceData.schoolExpense + advanceData.newAdvanceGiven;
    const byDate = useMemo(() => Object.fromEntries(monthRecords.map((record) => [record.date, record])), [monthRecords]);
    const sundayOptions = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => {
        const day = index + 1;
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { date, day, isAvailable: day <= periodEndDay, isPaid: Boolean(calculation?.earnedDays.find((item) => item.date === date)?.isPaidSunday) };
    }).filter((item) => new Date(year, month - 1, item.day).getDay() === 0);

    function updateEmployeeMenuPosition() {
        const rect = employeeSearchRef.current?.getBoundingClientRect();
        if (!rect || typeof window === "undefined") return;
        const width = Math.min(rect.width, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        const top = rect.bottom + 6;
        const maxHeight = Math.max(120, Math.min(300, window.innerHeight - top - 12));
        setEmployeeMenuRect({ left, top, width, maxHeight });
    }

    useEffect(() => {
        if (!employeeSearchOpen) return undefined;
        updateEmployeeMenuPosition();
        const onOutsidePointer = (event) => {
            if (!employeeSearchRef.current?.contains(event.target) && !employeeMenuRef.current?.contains(event.target)) {
                setEmployeeSearchOpen(false);
            }
        };
        window.addEventListener("resize", updateEmployeeMenuPosition);
        window.addEventListener("scroll", updateEmployeeMenuPosition, true);
        document.addEventListener("pointerdown", onOutsidePointer);
        return () => {
            window.removeEventListener("resize", updateEmployeeMenuPosition);
            window.removeEventListener("scroll", updateEmployeeMenuPosition, true);
            document.removeEventListener("pointerdown", onOutsidePointer);
        };
    }, [employeeSearchOpen, employeeSearch, employees.length]);

    function chooseEmployee(item) {
        setEmployeeId(item.employeeId);
        setEmployeeSearch(item.name);
        setEmployeeSearchOpen(false);
    }

    function clearEmployeeSearch() {
        setEmployeeId("");
        setEmployeeSearch("");
        setEmployeeSearchOpen(true);
        requestAnimationFrame(() => {
            employeeSearchRef.current?.querySelector("input")?.focus();
            updateEmployeeMenuPosition();
        });
    }

    function setValue(key, value) {
        setValues((current) => ({ ...current, [key]: value }));
    }

    function setAttendance(date, status) {
        setOverrides((current) => ({ ...current, [date]: status }));
    }

    function toggleSundayPay(date) {
        setPaidSundayDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date]);
    }

    async function saveSalary() {
        if (!employee || !calculation || !canSavePayroll) return;
        setSaving(true);
        try {
            const response = await fetch("/api/salaries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employee: employee._id,
                    month,
                    year,
                    baseSalary: Math.max(0, Number(employee.baseSalary) || 0),
                    workingDays: Math.max(1, calculation.workingDayCount),
                    daysPresent: Math.min(calculation.paidWorkingDays, Math.max(1, calculation.workingDayCount)),
                    totalCL: ANNUAL_CL_ALLOWANCE,
                    casualLeave: calculation.fullClDaysUsed + calculation.bonusClUsed,
                    halfCLTaken: calculation.halfClDaysUsed,
                    excessCL: 0,
                    emergencyLeave: Number(values.emergencyLeave) || 0,
                    bonus: calculation.bonus + calculation.sundayPay + calculation.holidayPay,
                    advanceGiven: calculation.newAdvanceGiven,
                    advanceDeduction: calculation.advanceDeduction,
                    pfAmount: calculation.pfAmount,
                    esslCalculatedNet: calculation.payable,
                    esslAdvanceRemaining: calculation.remainingAdvance,
                    status: "Pending",
                    notes: createEsslSalaryNote({
                        baseSalary: Math.max(0, Number(employee.baseSalary) || 0),
                        salaryPolicyVersion: 3,
                        workingDays: calculation.workingDayCount,
                        paidWorkingDays: calculation.paidWorkingDays,
                        presentDays: calculation.presentDays,
                        workedDays: calculation.workedDays,
                        absentDays: calculation.absentDays,
                        clTaken: calculation.clTaken,
                        bonusClUsed: calculation.bonusClUsed,
                        lateArrivalDays: calculation.lateArrivalDays,
                        lateArrivalBoundary: calculation.lateArrivalBoundary,
                        lateArrivalBonusDisqualified: calculation.lateArrivalBonusDisqualified,
                        clLimit: calculation.clLimit,
                        fullClDaysUsed: calculation.fullClDaysUsed,
                        halfClDaysUsed: calculation.halfClDaysUsed,
                        halfDays: calculation.halfDays,
                        dailyRate: calculation.dailyRate,
                        paidSundayDates: calculation.earnedDays.filter((day) => day.isPaidSunday).map((day) => day.date),
                        paidSundays: calculation.paidSundays,
                        sundayPay: calculation.sundayPay,
                        paidHolidays: calculation.paidHolidays,
                        holidayPay: calculation.holidayPay,
                        annualClUsed: calculation.annualClUsed,
                        annualClRemaining: calculation.annualClRemaining,
                        schoolDayEarnings: calculation.earnedSalary,
                        workedDaysSalary: calculation.workedDaysSalary,
                        paidClDays: calculation.paidClDays,
                        paidLeaveSalary: calculation.paidLeaveSalary,
                        clSalary: calculation.clSalary,
                        clHalfSalary: calculation.clHalfSalary,
                        paidEmergencyLeaveDays: calculation.paidEmergencyLeaveDays,
                        emergencyLeaveSalary: calculation.emergencyLeaveSalary,
                        baseSalaryEarnings: calculation.baseSalaryEarnings,
                        additionalEarnings: calculation.additionalEarnings,
                        attendanceDeductions: calculation.attendanceDeductions,
                        otherDeductions: calculation.otherDeductions,
                        halfDayDeduction: calculation.halfDayDeduction,
                        deductibleHalfDays: calculation.deductibleHalfDays,
                        absenceDeduction: calculation.absenceDeduction,
                        unpaidAbsenceDays: calculation.unpaidAbsenceDays,
                        bonus: calculation.bonus,
                        gross: calculation.gross,
                        previousPendingAdvance: calculation.previousPendingAdvance,
                        schoolExpense: calculation.schoolExpense,
                        newAdvanceGiven: calculation.newAdvanceGiven,
                        advancePool: calculation.advancePool,
                        requestedAdvanceDeduction: calculation.requestedAdvanceDeduction,
                        advanceDeduction: calculation.advanceDeduction,
                        actualAdvanceRecovered: calculation.actualAdvanceRecovered,
                        remainingAdvance: calculation.remainingAdvance,
                        pfAmount: calculation.pfAmount,
                        deductions: calculation.deductions,
                        netSalary: calculation.payable,
                        manualAttendanceOverrides: Object.keys(overrides).length
                    }, notes)
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Salary could not be saved");
            if (data.salary) {
                setEmployeeSalaries((current) => [
                    data.salary,
                    ...current.filter((salary) => !(Number(salary.month) === Number(data.salary.month) && Number(salary.year) === Number(data.salary.year)))
                ]);
            }
            notify({ tone: "success", title: "Salary saved to the Salary register" });
        } catch (error) {
            notify({ tone: "error", title: error.message || "Salary save failed" });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-8 bg-slate-50/50 p-4 rounded-3xl dark:bg-slate-900/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                    <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-indigo-500" /> Biometric Salary Calculator
                    </h1>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm max-w-2xl">
                        Seamlessly calculate monthly pay, adjust attendance manually, and review precise earning breakdowns with our modern tool.
                    </p>
                    </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all hover:scale-105 rounded-xl px-6 py-2.5 flex items-center gap-2"
                    onClick={syncAttendance} 
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Syncing..." : "Sync Attendance"}
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                    {lastMachineSync ? `Last machine sync: ${new Date(lastMachineSync).toLocaleString("en-IN")}${latestMachinePunch ? ` · Latest punch: ${latestMachinePunch}` : " · No punches in snapshot"}` : "No saved machine sync yet"}
                    {lastMachineSync ? (attendanceSnapshotStale ? " · Showing saved data" : attendanceSnapshotSaved ? " · Saved in Supabase" : " · Snapshot save failed") : ""}
                </p>
                </div>
            </div>

            <Card className="overflow-hidden border-0 shadow-xl shadow-indigo-100/50 dark:shadow-none bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 rounded-3xl">
                <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30 px-6 py-5 border-b border-indigo-100 dark:border-indigo-900/50">
                    <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-300">Period & Employee Selection</h2>
                    <p className="text-sm text-indigo-700/70 dark:text-indigo-400/70 mt-1">Configure the active payroll cycle and employee details below.</p>
                </div>
                <div className="grid gap-6 p-6 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Search Employee" className="space-y-1">
                        <div ref={employeeSearchRef} className="relative">
                            <Input 
                                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-11 hover:bg-slate-50 focus:bg-white focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/50 transition-colors"
                                autoComplete="off" 
                                value={employeeSearch} 
                                onFocus={() => { setEmployeeSearchOpen(true); updateEmployeeMenuPosition(); }} 
                                onChange={(event) => { setEmployeeSearch(event.target.value); setEmployeeId(""); setEmployeeSearchOpen(true); updateEmployeeMenuPosition(); }} 
                                placeholder="e.g. John Doe / 1024" 
                                aria-expanded={employeeSearchOpen} 
                                role="combobox" 
                                aria-autocomplete="list" 
                            />
                            {(employeeSearch || employeeId) && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearEmployeeSearch} className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear employee selection and search"><X className="h-4 w-4" /></button>}
                        </div>
                    </Field>
                    <Field label="Payroll Month" className="space-y-1">
                        <Select 
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/50 transition-colors cursor-pointer"
                            value={employeeId && (!salaryHistoryReady || salaryHistoryLoading || salaryHistoryError || !availableMonthOptions.some((item) => item.value === Number(month))) ? "" : month} 
                            onChange={(event) => setMonth(Number(event.target.value))}
                            disabled={Boolean(employeeId) && (!salaryHistoryReady || salaryHistoryLoading || Boolean(salaryHistoryError) || availableMonthOptions.length === 0)}
                        >
                            {employeeId && (!salaryHistoryReady || salaryHistoryLoading)
                                ? <option value="">Checking saved months…</option>
                                : salaryHistoryError
                                    ? <option value="">Could not check saved months</option>
                                    : employeeId && availableMonthOptions.length === 0
                                        ? <option value="">All months already have a salary</option>
                                        : availableMonthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </Select>
                        {employeeId && salaryHistoryError && <p className="mt-1 text-xs text-rose-600">{salaryHistoryError} Refresh the page before issuing salary.</p>}
                        {employeeId && salaryHistoryReady && !salaryHistoryLoading && !salaryHistoryError && availableMonthOptions.length === 0 && <p className="mt-1 text-xs text-amber-700">Delete a saved salary from its report to make that month available again.</p>}
                    </Field>
                    <Field label="Payroll Year" className="space-y-1">
                        <Input 
                            readOnly 
                            aria-label="Fixed payroll year" 
                            value={year} 
                            className="h-11 rounded-xl cursor-not-allowed bg-slate-100 text-slate-500 font-bold border-slate-200 dark:bg-slate-800/80 dark:border-slate-700" 
                        />
                    </Field>
                    <Field label={`Holiday Config · ${holidaySaveStatus}`} hint="Comma-separated day numbers" className="space-y-1">
                        <Input 
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/50 transition-colors"
                            value={holidays} 
                            onChange={(event) => { holidayValueRef.current = event.target.value; setHolidays(event.target.value); setHolidayDirty(true); setHolidaySaveStatus("Unsaved changes"); }} 
                            placeholder="e.g. 15, 26" 
                        />
                    </Field>
                </div>
                {employee && (
                    <div className="mx-6 mb-6">
                        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Users className="w-24 h-24" />
                            </div>
                            <div className="relative z-10 flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30">
                                    <Users className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight">{employee.name}</h3>
                                    <p className="text-blue-100 text-sm font-medium">{employee.employeeId} · {employee.department || employee.role}</p>
                                </div>
                            </div>
                            
                            <div className="relative z-10 flex flex-wrap gap-2 ml-auto">
                                <Badge title="Monthly CL Cap" value={calculation?.clLimit} color="bg-white/20 text-white border-white/20" />
                                <Badge title="Annual CL Left" value={`${calculation?.annualClRemaining} / ${ANNUAL_CL_ALLOWANCE}`} color="bg-emerald-500/80 text-white border-emerald-400/50" />
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/20 backdrop-blur-sm border border-white/10 text-xs font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 text-blue-200" />
                                    {attendance ? `eSSL ID: ${attendance.esslId} (${attendance.daysPresent} present)` : "Manual Input Mode"}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            {employee && calculation && (<>
                <Card className="overflow-hidden rounded-3xl border-0 shadow-lg ring-1 ring-indigo-100 dark:ring-indigo-900/50">
                    <div className="border-b border-indigo-100 bg-indigo-50/70 px-6 py-5 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Casual Leave Used This Month</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Machine Absent and Half Day statuses automatically use available CL, up to {calculation.clLimit} combined CL. Choose plain Absent or Half Day in the dropdown to opt out for that date; half-day CL counts as 0.5.</p>
                    </div>
                    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                        <MiniMetric label="CL Full Day" value={`${calculation.fullClDaysUsed} day${calculation.fullClDaysUsed === 1 ? "" : "s"}`} />
                        <MiniMetric label="CL Half Day Count" value={`${calculation.halfClDaysUsed} half-days (${formatCl(calculation.halfClDaysUsed / 2)} CL)`} />
                        <MiniMetric label="Attendance Bonus CL" value={`${formatCl(calculation.bonusClUsed)} CL`} />
                        <MiniMetric label="Total CL Taken" value={`${formatCl(calculation.clTaken)} / ${calculation.clLimit} CL`} />
                    </div>
                    <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div>
                            <p className="font-semibold text-amber-900 dark:text-amber-200">Attendance bonus eligibility</p>
                            <p className="mt-1 text-amber-800 dark:text-amber-300">{calculation.lateArrivalBonusDisqualified ? `Not eligible for the attendance bonus: ${calculation.lateArrivalDays.length} late arrivals (more than 3 allowed). Full-day attendance is unchanged.` : `${calculation.lateArrivalDays.length} late ${calculation.lateArrivalDays.length === 1 ? "arrival" : "arrivals"} after ${formatPunchBoundary(lateArrivalBoundary)}; more than 3 late arrivals disqualify the attendance bonus.`}</p>
                        </div>
                        <div className="w-40"><Field label="Late after"><Input type="time" value={lateArrivalBoundary} onChange={(event) => setLateArrivalBoundary(event.target.value)} /></Field><p className="mt-1 text-xs text-slate-500">Shared dashboard setting</p></div>
                    </div>
                    {calculation.lateArrivalBonusDisqualified && <div className="mx-5 mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/20">
                        <p className="font-semibold text-rose-800 dark:text-rose-200">Not eligible for the attendance bonus</p>
                        <p className="mt-1 text-rose-700 dark:text-rose-300">Late arrivals: {calculation.lateArrivalDays.map((item) => `${item.date.split("-").reverse().join("/")} (${formatPunchBoundary(item.time)})`).join(" · ")}. Daily attendance remains unchanged.</p>
                    </div>}
                    <div className="mx-5 mb-5 flex flex-wrap justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-indigo-100 dark:bg-slate-900 dark:ring-indigo-900/50">
                        <span className="text-slate-600 dark:text-slate-300">CL Full Day {calculation.fullClDaysUsed} + CL Half Day {calculation.halfClDaysUsed} ({formatCl(calculation.halfClDaysUsed / 2)} CL) + Attendance Bonus CL {formatCl(calculation.bonusClUsed)} = {formatCl(calculation.clTaken)} Total CL Taken</span>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300">Monthly CL left: {formatCl(Math.max(0, calculation.clLimit - calculation.clTaken))} · Annual CL left: {formatCl(calculation.annualClRemaining)} / {ANNUAL_CL_ALLOWANCE}</span>
                    </div>
                </Card>

                {/* Daily Register - Full Width */}
                <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-3xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Daily Register</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Attendance through {periodEndDay} {monthOptions[month - 1].label} · Holidays are paid · Sunday pay is selected separately</p>
                        </div>
                        <div className="flex gap-3">
                            <Legend color="bg-emerald-400" text="Paid" />
                            <Legend color="bg-red-400" text="Absent" />
                            <Legend color="bg-sky-400" text="CL" />
                            <Legend color="bg-amber-400" text="Half Day" />
                            <Legend color="bg-violet-400" text="Sunday" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3 p-5 bg-white dark:bg-slate-900">
                        {calculation.earnedDays.map((day) => {
                            const record = byDate[day.date];
                            const selectedStatus = Object.prototype.hasOwnProperty.call(overrides, day.date) ? overrides[day.date] : day.status;
                            const disabled = day.isSunday;
                            const isAutoCl = day.isClApplied || day.isHalfClApplied;
                            
                            let dayStyle = "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50";
                            if (day.isPaidSunday || day.isPaidHoliday) dayStyle = "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20";
                            else if (day.isSunday) dayStyle = "border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-900/20";
                            else if (day.status !== "Holiday") {
                                if (isAutoCl) dayStyle = "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-900/20";
                                else if (day.status === "Half Day" || day.status === "CL Half Day") dayStyle = "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20";
                                else if (day.earnsDay) dayStyle = "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20";
                                else dayStyle = "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20";
                            }

                            const halfLeaveStatus = day.status === "Half Day" || day.status === "CL Half Day";
                            const explicitClAbsent = day.status === "CL Absent";
                            const clUnavailableReason = calculation.clLimit === 0
                                ? "CL Not Eligible"
                                : calculation.annualClRemaining === 0
                                    ? "Annual CL limit"
                                    : "Monthly CL limit";
                            const statusLabel = day.isPaidSunday ? "Paid Sunday" : day.isPaidHoliday ? "Paid Holiday" : day.isSunday ? "Weekend" : day.isHalfClApplied ? "½ CL Used · Half Pay" : day.isClApplied ? "1 CL Used · Paid" : halfLeaveStatus ? (day.status === "CL Half Day" ? `${clUnavailableReason} · Half Pay` : "Half Pay") : explicitClAbsent ? `${clUnavailableReason} · No Pay` : day.earnsDay ? "Paid" : "Absent";
                            
                            const statusColor = day.isPaidSunday || day.isPaidHoliday ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50" 
                                : day.isSunday ? "text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-900/50" 
                                : isAutoCl ? "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/50" 
                                : halfLeaveStatus ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50"
                                : day.earnsDay ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50" 
                                : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50";

                            return (
                                <div key={day.date} className={`group flex flex-col rounded-2xl border p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${dayStyle}`} style={{ minWidth: 0 }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}
                                        </span>
                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${day.isSunday ? 'bg-slate-200 text-slate-500' : 'bg-white text-slate-800 dark:bg-slate-950 dark:text-white'}`}>
                                            {String(day.date).slice(-2)}
                                        </span>
                                    </div>
                                    <Select 
                                        aria-label={`Attendance status ${day.date}`} 
                                        disabled={disabled} 
                                        value={disabled ? "Sunday" : selectedStatus} 
                                        onChange={(event) => setAttendance(day.date, event.target.value)} 
                                        className={`h-9 w-full text-xs rounded-lg border shadow-sm font-medium ${day.isSunday ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-100' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 hover:bg-slate-50 cursor-pointer'}`}
                                    >
                                        <option value="Sunday">Sunday</option>
                                        {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                                    </Select>
                                    <div className="mt-2 text-center">
                                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md w-full ${statusColor}`}>
                                            {isAutoCl && <Check aria-hidden="true" className="mr-1 inline h-3 w-3" strokeWidth={3} />}
                                            {statusLabel}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="overflow-hidden rounded-3xl border-0 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800">
                    <div className="border-b border-slate-100 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/50">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Sunday pay</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select each Sunday to pay. Every selected Sunday adds one working day and one daily rate. Only Sundays up to the current payroll date are available.</p>
                    </div>
                    <div className="flex flex-wrap gap-3 p-5">
                        {sundayOptions.length ? sundayOptions.map((day, index) => {
                            const selected = paidSundayDates.includes(day.date);
                            const disabled = (!day.isAvailable && !selected) || (!selected && calculation.workingDayCount >= 30);
                            const cappedOut = selected && !day.isPaid;
                            return <button key={day.date} type="button" aria-pressed={selected} disabled={disabled} onClick={() => toggleSundayPay(day.date)} className={`flex min-w-[185px] items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selected && !cappedOut ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>
                                <span><span className="block text-sm font-bold">{ordinal(index + 1)} Sunday</span><span className="block text-xs opacity-70">{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${selected && !cappedOut ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{!day.isAvailable ? "Upcoming" : cappedOut ? "30-day cap" : selected ? "Selected" : "Add pay"}</span>
                            </button>;
                        }) : <p className="text-sm text-muted-foreground">No Sundays have reached this payroll date yet.</p>}
                    </div>
                    <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-950/30">
                        <span className="font-medium text-indigo-900 dark:text-indigo-200">{calculation.paidSundays} Sunday{calculation.paidSundays === 1 ? "" : "s"} selected × {currency(calculation.dailyRate)}</span>
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">Sunday pay {currency(calculation.sundayPay)} · Total payable days {calculation.workingDayCount}/30</span>
                    </div>
                </Card>
                {/* Adjustments */}
                <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-none rounded-3xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Adjustments & Overrides</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Salary is calculated from paid working days, paid CL, and approved paid leave. Unpaid attendance is not deducted twice; advance and PF are deducted from salary.</p>
                    </div>
                    <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 bg-white dark:bg-slate-900">
                        <Field label="Employee Profile Base Salary (₹)" hint="Managed in the employee profile" className="xl:col-span-1"><Input type="number" min="0" className="h-11 rounded-xl" value={Math.max(0, Number(employee.baseSalary) || 0)} readOnly /></Field>
                        <Field label="Total Working Days" hint="Max 30" className="xl:col-span-1"><Input type="number" min="1" max="30" className="h-11 rounded-xl" value={calculation.workingDayCount} onChange={(event) => { const total = Math.min(30, Math.max(0, Number(event.target.value) || 0)); setValue("workingDays", Math.max(0, total - calculation.paidHolidays - calculation.paidSundays)); }} /></Field>
                        <Field label="Emergency Leave (Days)" className="xl:col-span-1"><Input type="number" min="0" step="0.5" className="h-11 rounded-xl" value={values.emergencyLeave} onChange={(event) => setValue("emergencyLeave", event.target.value)} /></Field>
                        <Field label="Bonus / Extras (₹)" className="xl:col-span-1"><Input type="number" min="0" className="h-11 rounded-xl" value={calculation.bonus} onChange={(event) => setValue("bonus", Math.max(0, (Number(event.target.value) || 0) - calculation.fullAttendanceBonus))} /></Field>
                        <Field label="Previous Pending Advance (₹)" hint="Automatically brought forward" className="xl:col-span-1"><Input type="text" className="h-11 rounded-xl" value={advanceLoading ? "Loading…" : currency(advanceData.previousPendingAdvance)} readOnly disabled /></Field>
                        <Field label="Company Expense (₹)" hint="Open expense balance included in the pool" className="xl:col-span-1"><Input type="text" className="h-11 rounded-xl" value={advanceLoading ? "Loading…" : currency(advanceData.schoolExpense)} readOnly disabled /></Field>
                        <Field label="New Advance Given (₹)" hint="Advance given this month" className="xl:col-span-1"><Input type="number" min="0" step="0.01" className="h-11 rounded-xl" value={advanceData.newAdvanceGiven} disabled={advanceLoading} onChange={(event) => { const newAdvanceGiven = Math.max(0, Number(event.target.value) || 0); const pool = advanceData.previousPendingAdvance + advanceData.schoolExpense + newAdvanceGiven; setAdvanceData((current) => ({ ...current, newAdvanceGiven })); setValue("advanceDeduction", Math.min(Number(values.advanceDeduction) || 0, pool)); }} /></Field>
                        <Field label="Advance Deduction (₹)" hint={`Maximum pool: ${currency(totalAdvancePool)}`} className="xl:col-span-1"><Input type="number" min="0" step="0.01" className="h-11 rounded-xl" value={values.advanceDeduction} disabled={advanceLoading} onChange={(event) => setValue("advanceDeduction", Math.min(Math.max(0, Number(event.target.value) || 0), totalAdvancePool))} /></Field>
                        <Field label="PF Deduction (₹)" hint="Enter this month’s PF deduction" className="xl:col-span-1"><Input type="number" min="0" className="h-11 rounded-xl" value={values.pfAmount} onChange={(event) => setValue("pfAmount", event.target.value)} /></Field>
                        {advanceLoadError && <p className="sm:col-span-2 lg:col-span-3 xl:col-span-6 text-sm font-medium text-rose-700 dark:text-rose-300">{advanceLoadError}</p>}
                        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
                            <Field label="Payroll Notes"><Textarea className="rounded-xl min-h-[80px]" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add any special remarks for this salary..." /></Field>
                        </div>
                    </div>
                </Card>

                {/* Salary Breakdown (Landscape) & Save */}
                <Card className="border-0 shadow-xl shadow-indigo-100/40 dark:shadow-none rounded-3xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900">
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><IndianRupee className="w-6 h-6 text-emerald-400" /> Final Salary Breakdown</h2>
                    </div>
                    
                    <div className="p-8">
                        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                            <MiniMetric label="CL Full Day" value={`${calculation.fullClDaysUsed} day${calculation.fullClDaysUsed === 1 ? "" : "s"}`} />
                            <MiniMetric label="CL Half Day Count" value={`${calculation.halfClDaysUsed} half-days = ${formatCl(calculation.halfClDaysUsed / 2)} CL`} />
                            <MiniMetric label="Attendance Bonus CL" value={`${formatCl(calculation.bonusClUsed)} CL`} />
                            <MiniMetric label="Total CL Taken" value={`${formatCl(calculation.clTaken)} / ${calculation.clLimit} CL`} />
                            <MiniMetric label="Monthly CL Left" value={formatCl(Math.max(0, calculation.clLimit - calculation.clTaken))} />
                            <MiniMetric label="Annual CL Left" value={`${formatCl(calculation.annualClRemaining)} / ${ANNUAL_CL_ALLOWANCE}`} />
                        </div>
                        <div className="grid lg:grid-cols-3 gap-10">
                            {/* Column 1: Earnings */}
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <MiniMetric label="Daily Rate" value={currency(calculation.dailyRate)} />
                                    <MiniMetric label="Paid Days" value={`${calculation.paidWorkingDays}/${calculation.workingDayCount}`} />
                                </div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Earnings</h3>
                                <LineItem label="Salary for Days Worked" detail={`${calculation.presentDays} full day${calculation.presentDays === 1 ? "" : "s"} + ${calculation.halfDays} half-day${calculation.halfDays === 1 ? "" : "s"} = ${formatCl(calculation.workedDays)} paid workday-equivalents × ${currency(calculation.dailyRate)}`} amount={calculation.workedDaysSalary} />
                                <LineItem label="Paid CL — Full Day" detail={`${calculation.fullClDaysUsed} paid full CL day${calculation.fullClDaysUsed === 1 ? "" : "s"} × ${currency(calculation.dailyRate)}`} amount={calculation.clSalary} />
                                <LineItem label="Paid CL — Half Day" detail={`${calculation.halfClDaysUsed} paid half-CL day${calculation.halfClDaysUsed === 1 ? "" : "s"} = ${formatCl(calculation.halfClDaysUsed / 2)} CL day${calculation.halfClDaysUsed === 2 ? "" : "s"} × ½ × ${currency(calculation.dailyRate)}`} amount={calculation.clHalfSalary} />
                                {calculation.paidEmergencyLeaveDays > 0 && <LineItem label="Paid Emergency Leave" detail={`${formatCl(calculation.paidEmergencyLeaveDays)} paid emergency-leave day${calculation.paidEmergencyLeaveDays === 1 ? "" : "s"} × ${currency(calculation.dailyRate)}`} amount={calculation.emergencyLeaveSalary} />}
                                <LineItem label="Sunday Pay" detail={`${calculation.paidSundays} selected Sunday${calculation.paidSundays === 1 ? "" : "s"} × ${currency(calculation.dailyRate)}`} amount={calculation.sundayPay} />
                                <LineItem label="Holiday Pay" detail={`${calculation.paidHolidays} paid holiday${calculation.paidHolidays === 1 ? "" : "s"} × ${currency(calculation.dailyRate)}`} amount={calculation.holidayPay} />
                                <LineItem label="Bonus Amount" detail={calculation.fullAttendanceBonus ? `Full-month attendance bonus: ${currency(calculation.dailyRate)}; 1 CL deducted from balance` : "Manual"} amount={calculation.bonus} />
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/30">
                                    <div className="flex justify-between gap-3"><span className="font-semibold text-indigo-900 dark:text-indigo-200">Monthly base salary (employee profile)</span><span className="font-bold text-indigo-900 dark:text-indigo-200">{currency(employee.baseSalary)}</span></div>
                                    <div className="mt-1 flex justify-between gap-3"><span className="text-indigo-800 dark:text-indigo-300">Salary for paid work + paid leave</span><span className="font-semibold text-indigo-900 dark:text-indigo-200">{currency(calculation.baseSalaryEarnings)}</span></div>
                                    <div className="mt-1 flex justify-between gap-3"><span className="text-indigo-800 dark:text-indigo-300">Paid CL total value ({formatCl(calculation.paidClDays)} days)</span><span className="font-semibold text-indigo-900 dark:text-indigo-200">{currency(calculation.paidLeaveSalary)}</span></div>
                                    <p className="mt-2 border-t border-indigo-200 pt-2 text-xs text-indigo-800 dark:border-indigo-800 dark:text-indigo-300">Rate: {currency(calculation.dailyRate)} per salary day. Unpaid attendance is already excluded from earned pay, so it is not deducted again. Advance and PF are deducted below.</p>
                                    <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-300">Additional earnings (Sunday + holiday + bonus): {currency(calculation.additionalEarnings)}.</p>
                                </div>
                            </div>

                            {/* Column 2: Deductions & Gross */}
                            <div className="space-y-5 flex flex-col">
                                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl mb-6">
                                    <span className="font-bold text-slate-600 dark:text-slate-400 uppercase text-xs tracking-widest">Salary Before Advance + PF</span>
                                    <span className="text-xl font-black text-slate-900 dark:text-white">{currency(calculation.gross)}</span>
                                </div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Deductions</h3>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unpaid attendance (already excluded from earned pay)</p>
                                <LineItem label="Unpaid Half-day Amount" detail={`${calculation.deductibleHalfDays} half-days not covered by CL × ½ × ${currency(calculation.dailyRate)}; shown separately, not subtracted`} amount={calculation.halfDayDeduction} deduction />
                                {calculation.unpaidAbsenceDays > 0 && <LineItem label="Unpaid Absence Amount" detail={`${calculation.unpaidAbsenceDays} unpaid day${calculation.unpaidAbsenceDays === 1 ? "" : "s"} × ${currency(calculation.dailyRate)}; shown separately, not subtracted`} amount={calculation.absenceDeduction} deduction />}
                                {calculation.advancePool > 0 && <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                                    <p className="mb-2 font-bold text-slate-700 dark:text-slate-200">Advance Recovery Pool</p>
                                    <p className="flex justify-between"><span>Previous pending advance</span><span>{currency(calculation.previousPendingAdvance)}</span></p>
                                    <p className="flex justify-between"><span>Company expense</span><span>{currency(calculation.schoolExpense)}</span></p>
                                    <p className="flex justify-between"><span>New advance given</span><span>{currency(calculation.newAdvanceGiven)}</span></p>
                                    <p className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700"><span>Total available</span><span>{currency(calculation.advancePool)}</span></p>
                                    <p className="mt-1 flex justify-between text-amber-700 dark:text-amber-300"><span>Remaining after this month</span><span>{currency(calculation.remainingAdvance)}</span></p>
                                </div>}
                                <p className="pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Actual deductions from salary</p>
                                <LineItem label="Advance Repayment / Deduction" detail={`${calculation.requestedAdvanceDeduction > calculation.advanceDeduction ? `Requested ${currency(calculation.requestedAdvanceDeduction)}; ` : ""}deducted from salary; remaining advance ${currency(calculation.remainingAdvance)}`} amount={calculation.advanceDeduction} deduction />
                                <LineItem label="PF Deduction" detail="Deducted from salary" amount={calculation.pfAmount} deduction />
                                <div className="mt-auto pt-4">
                                    <div className="flex justify-between items-center bg-rose-50/50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/50">
                                        <span className="font-bold text-rose-800 dark:text-rose-300 text-xs uppercase tracking-widest">Total Salary Deductions</span>
                                        <span className="font-bold text-rose-600 dark:text-rose-400">{currency(calculation.deductions)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: Net Payable */}
                            <div className="flex flex-col gap-4 justify-end">
                                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg shadow-emerald-200/50 dark:shadow-none mb-2">
                                    <span className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Salary Payable</span>
                                    <span className="text-4xl font-black tracking-tight">{currency(calculation.payable)}</span>
                                    <div className="mt-4 pt-4 border-t border-emerald-400/30 flex justify-between text-xs text-emerald-50 font-medium">
                                        <span>Before deductions: {currency(calculation.gross)}</span>
                                        <span>Advance + PF: {currency(calculation.deductions)}</span>
                                    </div>
                                </div>
                                <Button 
                                    className="w-full h-12 text-base font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100" 
                                    onClick={saveSalary} 
                                    disabled={saving || advanceLoading || Boolean(advanceLoadError) || !canSavePayroll}
                                >
                                    {saving ? (
                                        <span className="flex items-center gap-2"><RefreshCw className="h-5 w-5 animate-spin" /> Finalizing...</span>
                                    ) : (
                                        <span className="flex items-center gap-2"><Save className="h-5 w-5" /> Save & Issue Salary</span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </>)}

            {!employee && (
                <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm min-h-[400px]">
                    <div className="h-24 w-24 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-6">
                        <Calculator className="h-10 w-10 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">No Employee Selected</h3>
                    <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md">
                        Please search and select an employee from the configuration panel above to begin calculating their monthly salary.
                    </p>
                </div>
            )}

            {employeeSearchOpen && employeeMenuRect && typeof document !== "undefined" && createPortal(
                <div 
                    ref={employeeMenuRef} 
                    role="listbox" 
                    className="overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-2 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/95" 
                    style={{ position: "fixed", left: employeeMenuRect.left, top: employeeMenuRect.top, width: employeeMenuRect.width, maxHeight: employeeMenuRect.maxHeight, zIndex: 9999 }}
                >
                    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">{employeeSearch.trim() ? `${matchingEmployees.length} matching employees` : `${matchingEmployees.length} active employees`}</div>
                    {matchingEmployees.length ? matchingEmployees.map((item) => (
                        <button 
                            key={item.employeeId} 
                            type="button" 
                            role="option" 
                            aria-selected={item.employeeId === employeeId} 
                            onMouseDown={(event) => event.preventDefault()} 
                            onClick={() => chooseEmployee(item)} 
                            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/40 group"
                        >
                            <div className="flex flex-col min-w-0">
                                <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{item.name}</span>
                                <span className="block text-xs font-medium text-slate-500">{item.employeeId} • {item.department || item.role}</span>
                            </div>
                            {item.employeeId === employeeId && <Check className="h-5 w-5 shrink-0 text-indigo-600" />}
                        </button>
                    )) : <div className="px-4 py-6 text-center text-sm font-medium text-slate-500">No matches found for “{employeeSearch}”</div>}
                </div>, 
            document.body)}
        </div>
    );
}

// UI Helper Components
function Badge({ title, value, color }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${color}`}>
            <span className="opacity-80">{title}:</span>
            <span>{value}</span>
        </div>
    );
}

function Legend({ color, text }) {
    return (
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
            <span className={`w-3 h-3 rounded-full ${color}`}></span> {text}
        </div>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
            <p className="text-lg font-extrabold text-slate-800 dark:text-slate-200">{value}</p>
        </div>
    );
}

function ordinal(value) {
    const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th");
    return `${value}${suffix}`;
}

function formatPunchBoundary(value) {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatCl(value) {
    return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function LineItem({ label, detail, amount, deduction = false }) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex flex-col">
                <span className={`text-sm font-medium ${deduction ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{label}</span>
                {detail && <span className="text-[10px] font-medium text-slate-400">{detail}</span>}
            </div>
            <span className={`text-sm font-bold tabular-nums ${deduction ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                {currency(amount)}
            </span>
        </div>
    );
}
