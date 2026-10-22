"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeading } from "@/components/page-heading";
import { formatCurrency, formatDate, monthName } from "@/lib/utils";
import { parseEsslSalaryNote } from "@/lib/essl-salary/report-data";
import { Download, Eye, EyeOff, Printer, RefreshCw, Search, Trash2 } from "lucide-react";

// This report deliberately lives apart from the general ledger report and only lists ESSL-calculator saves.
export function EsslSalaryReportClient() {
    const { notify } = useToast();
    const [salaries, setSalaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastMachineSync, setLastMachineSync] = useState(null);
    const [latestMachinePunch, setLatestMachinePunch] = useState(null);
    const [machineSnapshotStale, setMachineSnapshotStale] = useState(false);
    const [machineSnapshotSaved, setMachineSnapshotSaved] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedSalary, setSelectedSalary] = useState(null);
    const [deletePassword, setDeletePassword] = useState("");
    const [showDeletePassword, setShowDeletePassword] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState({ query: "", employeeId: "All", month: "All", year: String(new Date().getFullYear()), status: "All" });

    async function loadReport() {
        setLoading(true);
        try {
            const month = new Date().getMonth() + 1;
            const year = new Date().getFullYear();
            const response = await fetch("/api/salaries?limit=1000", { cache: "no-store" });
            const data = response.ok ? await response.json() : { salaries: [] };
            setSalaries((data.salaries || []).filter((salary) => String(salary.notes || "").includes("ESSL Calculator:")));
            fetch(`/api/essl/report?month=${month}&year=${year}`, { cache: "no-store" })
                .then((machineResponse) => machineResponse.ok ? machineResponse.json() : null)
                .then((machineData) => {
                    if (!machineData?.success) return;
                    setLastMachineSync(machineData.lastSyncedAt || null);
                    setLatestMachinePunch(machineData.latestPunch || machineData.diagnostics?.latestPunch || null);
                    setMachineSnapshotStale(Boolean(machineData.stale));
                    setMachineSnapshotSaved(machineData.snapshotSaved !== false);
                })
                .catch(() => null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadReport();
        fetch("/api/auth/me", { cache: "no-store" })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => setCurrentUser(data?.user || null))
            .catch(() => setCurrentUser(null));
    }, []);

    const canDeleteSalary = currentUser?.role === "Admin" || currentUser?.permissions?.includes("salary.delete");

    function openDeleteDialog(salary) {
        setSelectedSalary(salary);
        setDeletePassword("");
        setShowDeletePassword(false);
    }

    async function deleteSalary(event) {
        event.preventDefault();
        if (!selectedSalary || !deletePassword || deleting) return;
        setDeleting(true);
        try {
            const response = await fetch(`/api/salaries/${selectedSalary._id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: deletePassword })
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message || "Salary could not be deleted");
            setSalaries((current) => current.filter((salary) => salary._id !== selectedSalary._id));
            notify({ tone: "success", title: "Salary record deleted" });
            setSelectedSalary(null);
        } catch (error) {
            notify({ tone: "error", title: error.message || "Salary could not be deleted" });
        } finally {
            setDeleting(false);
        }
    }

    const employees = useMemo(() => {
        const unique = new Map();
        salaries.forEach((salary) => unique.set(salary.employeeId, { employeeId: salary.employeeId, name: salary.employee?.name || salary.employeeId }));
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [salaries]);

    const years = useMemo(() => [...new Set(salaries.map((salary) => Number(salary.year)))].sort((a, b) => b - a), [salaries]);

    const filtered = useMemo(() => salaries.filter((salary) => {
        const target = `${salary.employee?.name || ""} ${salary.employeeId}`.toLowerCase();
        return target.includes(filters.query.toLowerCase())
            && (filters.employeeId === "All" || salary.employeeId === filters.employeeId)
            && (filters.month === "All" || Number(salary.month) === Number(filters.month))
            && (!filters.year || Number(salary.year) === Number(filters.year))
            && (filters.status === "All" || salary.status === filters.status);
    }).sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month) || (a.employee?.name || "").localeCompare(b.employee?.name || "")), [salaries, filters]);

    const totals = useMemo(() => ({
        gross: filtered.reduce((sum, item) => sum + grossFor(item), 0),
        basePayAfterAttendance: filtered.reduce((sum, item) => sum + basePayAfterAttendanceFor(item), 0),
        deductions: filtered.reduce((sum, item) => sum + deductionsFor(item), 0),
        net: filtered.reduce((sum, item) => sum + netFor(item), 0),
        paid: filtered.filter((item) => item.status === "Paid").length,
        pending: filtered.filter((item) => item.status !== "Paid").length
    }), [filtered]);

    function exportCsv() {
        const columns = ["Employee", "Employee ID", "Month", "Year", "Working Days", "Paid Days", "Full Days Worked", "Half Days Worked", "Salary for Days Worked", "Paid CL Full Days", "Paid CL Full Day Pay", "Paid CL Half Days", "Paid CL Half Day Pay", "Paid CL Equivalent Days", "Attendance Bonus CL", "Total CL Taken", "Paid Emergency Leave Days", "Paid Emergency Leave Pay", "Sundays Paid", "Sunday Pay", "Holidays Paid", "Holiday Pay", "Unpaid Absence Days", "Unpaid Absence Amount", "Unpaid Half-days", "Unpaid Half-day Amount", "Bonus", "Salary Before Salary Deductions", "Base Salary Portion", "Advance Pool", "Advance Deduction", "Remaining Advance", "PF Deduction", "Total Deductions from Salary", "Net Salary Payable", "Status", "Payment Date"];
        const rows = filtered.map((item) => { const payroll = reportDataFor(item); return [item.employee?.name || "", item.employeeId, monthName(item.month), item.year, item.workingDays, item.daysPresent, payroll?.presentDays ?? "", payroll?.halfDays ?? "", payroll?.workedDaysSalary ?? "", payroll?.fullClDaysUsed ?? item.casualLeave, payroll?.clSalary ?? 0, payroll?.halfClDaysUsed ?? item.halfCLTaken, payroll?.clHalfSalary ?? 0, payroll?.paidClDays ?? (Number(payroll?.fullClDaysUsed || 0) + Number(payroll?.halfClDaysUsed || 0) / 2), payroll?.bonusClUsed ?? 0, payroll?.clTaken ?? item.casualLeave, payroll?.paidEmergencyLeaveDays ?? 0, payroll?.emergencyLeaveSalary ?? 0, payroll?.paidSundays ?? 0, payroll?.sundayPay ?? 0, payroll?.paidHolidays ?? 0, payroll?.holidayPay ?? 0, payroll?.unpaidAbsenceDays ?? 0, payroll?.absenceDeduction ?? 0, payroll?.deductibleHalfDays ?? 0, payroll?.halfDayDeduction ?? 0, payroll?.bonus ?? item.bonus, grossFor(item), basePayAfterAttendanceFor(item), payroll?.advancePool ?? (Number(item.previousPendingAdvance || 0) + Number(item.ledgerDeduction || 0) + Number(item.advanceGiven || 0)), payroll?.advanceDeduction ?? item.advanceDeduction ?? 0, payroll?.remainingAdvance ?? item.remainingAdvance ?? 0, payroll?.pfAmount ?? payroll?.otherDeduction ?? item.pfAmount ?? 0, deductionsFor(item), netFor(item), item.status, item.paymentDate ? formatDate(item.paymentDate) : ""]; });
        const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `essl-machine-salary-report-${filters.year || "all"}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    return <div className="space-y-6">
        <PageHeading title="Biometric Salary Report" description={`Saved salary calculations from the Biometric Salary Calculator, with attendance, deductions, totals, and printable salary slips. Last machine sync: ${lastMachineSync ? new Date(lastMachineSync).toLocaleString("en-IN") : "not recorded"}${latestMachinePunch ? ` · Latest punch: ${latestMachinePunch}` : ""}${machineSnapshotStale ? " · Showing the saved machine snapshot" : ""}${machineSnapshotSaved === false ? " · Supabase snapshot save failed" : machineSnapshotSaved ? " · Attendance snapshot saved in Supabase" : ""}.`} action={<div className="flex gap-2"><Button variant="secondary" onClick={loadReport} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button><Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print report</Button><Button onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" />Export CSV</Button></div>} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Metric label="Salary Before Salary Deductions" value={formatCurrency(totals.gross)} />
            <Metric label="Base Salary Portion" value={formatCurrency(totals.basePayAfterAttendance)} />
            <Metric label="Deductions on Record" value={formatCurrency(totals.deductions)} />
            <Metric label="Net Salary Payable" value={formatCurrency(totals.net)} />
            <Metric label="Paid" value={String(totals.paid)} tone="text-emerald-600" />
            <Metric label="Unpaid" value={String(totals.pending)} tone="text-blue-600" />
        </div>

        <Card>
            <CardHeader title="Salary History" description={`${filtered.length} saved salary record${filtered.length === 1 ? "" : "s"} matched`} />
            <div className="grid gap-3 border-b border-border p-5 lg:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_1fr]">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search employee" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></div>
                <Select value={filters.employeeId} onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}><option value="All">All Employees</option>{employees.map((item) => <option key={item.employeeId} value={item.employeeId}>{item.name}</option>)}</Select>
                <Select value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })}><option value="All">All Months</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{monthName(month)}</option>)}</Select>
                <Select value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })}><option value="">All Years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</Select>
                <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="All">All Status</option><option value="Paid">Paid</option><option value="Pending">Unpaid</option></Select>
            </div>

            {filtered.length === 0 ? <EmptyState title={loading ? "Loading salary report" : "No salary history"} description={loading ? "Saved salary records are loading." : "Save a salary from Biometric Salary Calculator to see it here."} /> : <div className="overflow-x-auto"><table className="w-full min-w-[1850px] text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Month</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">CL / Additions</th><th className="px-4 py-3">Salary Before Deductions</th><th className="px-4 py-3">Base Salary Portion</th><th className="px-4 py-3">Advance Recovery</th><th className="px-4 py-3">PF Deduction</th><th className="px-4 py-3">Deductions on Record</th><th className="px-4 py-3">Net Salary Payable</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment Date</th><th className="px-4 py-3 text-right">Salary Slip</th>{canDeleteSalary ? <th className="px-4 py-3 text-right">Actions</th> : null}</tr></thead>
                <tbody className="divide-y divide-border">{filtered.map((salary) => <tr key={salary._id} className="hover:bg-muted/50">
                    <td className="px-4 py-4"><p className="font-semibold">{salary.employee?.name || salary.employeeId}</p><p className="text-xs text-muted-foreground">{salary.employeeId}</p></td>
                    <td className="px-4 py-4">{monthName(salary.month)} {salary.year}</td>
                    <td className="px-4 py-4">{salary.daysPresent}/{salary.workingDays} paid<p className="text-xs text-muted-foreground">{reportDataFor(salary)?.unpaidAbsenceDays ?? salary.absentDays} unpaid days</p></td>
                    <td className="px-4 py-4"><span className="font-medium">CL Full Day: {reportDataFor(salary)?.fullClDaysUsed ?? salary.casualLeave ?? 0} ({formatCurrency(reportDataFor(salary)?.clSalary ?? 0)})</span><p className="text-xs text-muted-foreground">CL Half Day: {reportDataFor(salary)?.halfClDaysUsed ?? salary.halfCLTaken ?? 0} ({Number(reportDataFor(salary)?.halfClDaysUsed ?? salary.halfCLTaken ?? 0) / 2} CL; {formatCurrency(reportDataFor(salary)?.clHalfSalary ?? 0)}) · Bonus CL: {reportDataFor(salary)?.bonusClUsed ?? 0} · Total CL Taken: {reportDataFor(salary)?.clTaken ?? salary.casualLeave ?? 0}<br />Worked-day pay {formatCurrency(reportDataFor(salary)?.workedDaysSalary ?? 0)} · Emergency leave {formatCurrency(reportDataFor(salary)?.emergencyLeaveSalary ?? 0)} · Sun {reportDataFor(salary)?.paidSundays ?? 0} ({formatCurrency(reportDataFor(salary)?.sundayPay ?? 0)}) · Hol {reportDataFor(salary)?.paidHolidays ?? 0} ({formatCurrency(reportDataFor(salary)?.holidayPay ?? 0)}) · Bonus {formatCurrency(reportDataFor(salary)?.bonus ?? salary.bonus)}</p></td>
                    <td className="px-4 py-4">{formatCurrency(grossFor(salary))}</td>
                    <td className="px-4 py-4">{formatCurrency(basePayAfterAttendanceFor(salary))}<p className="text-xs text-muted-foreground">{Number(reportDataFor(salary)?.salaryPolicyVersion) >= 3 ? "Paid work + paid CL + approved paid leave." : "Base salary portion in the saved calculation."}</p></td>
                    <td className="px-4 py-4">{formatCurrency(reportDataFor(salary)?.advanceDeduction ?? salary.advanceDeduction ?? 0)}<p className="text-xs text-muted-foreground">Pool {formatCurrency(reportDataFor(salary)?.advancePool ?? (Number(salary.previousPendingAdvance || 0) + Number(salary.ledgerDeduction || 0) + Number(salary.advanceGiven || 0)))} · Left {formatCurrency(reportDataFor(salary)?.remainingAdvance ?? salary.remainingAdvance ?? 0)}</p></td>
                    <td className="px-4 py-4">{formatCurrency(reportDataFor(salary)?.pfAmount ?? reportDataFor(salary)?.otherDeduction ?? salary.pfAmount ?? 0)}</td>
                    <td className="px-4 py-4 text-rose-700 dark:text-rose-300">{formatCurrency(deductionsFor(salary))}<p className="text-xs text-muted-foreground">{Number(reportDataFor(salary)?.salaryPolicyVersion) >= 3 ? <>Advance + PF; unpaid attendance value {formatCurrency(Number(reportDataFor(salary)?.attendanceDeductions || 0))} was already excluded from earnings.</> : "Includes attendance and other saved deductions."}</p></td>
                    <td className="px-4 py-4 font-bold">{formatCurrency(netFor(salary))}</td>
                    <td className="px-4 py-4"><Badge tone={salary.status === "Paid" ? "success" : "neutral"}>{salary.status === "Paid" ? "Paid" : "Unpaid"}</Badge></td>
                    <td className="px-4 py-4">{salary.paymentDate ? formatDate(salary.paymentDate) : "—"}</td>
                    <td className="px-4 py-4 text-right"><Link href={`/slips/${salary._id}`} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"><Printer className="h-4 w-4" />View / Print</Link></td>
                    {canDeleteSalary ? <td className="px-4 py-4 text-right"><Button variant="danger" size="sm" onClick={() => openDeleteDialog(salary)} aria-label={`Delete ${salary.employee?.name || salary.employeeId} ${monthName(salary.month)} ${salary.year} salary`}><Trash2 className="h-4 w-4" />Delete</Button></td> : null}
                </tr>)}</tbody>
                <tfoot className="border-t-2 bg-muted/60 font-bold"><tr><td className="px-4 py-3" colSpan={4}>Filtered totals</td><td className="px-4 py-3">{formatCurrency(totals.gross)}</td><td className="px-4 py-3">{formatCurrency(totals.basePayAfterAttendance)}</td><td className="px-4 py-3">{formatCurrency(filtered.reduce((sum, item) => sum + Number(reportDataFor(item)?.advanceDeduction ?? item.advanceDeduction ?? 0), 0))}</td><td className="px-4 py-3">{formatCurrency(filtered.reduce((sum, item) => sum + Number(reportDataFor(item)?.pfAmount ?? reportDataFor(item)?.otherDeduction ?? item.pfAmount ?? 0), 0))}</td><td className="px-4 py-3">{formatCurrency(totals.deductions)}</td><td className="px-4 py-3">{formatCurrency(totals.net)}</td><td className="px-4 py-3" colSpan={canDeleteSalary ? 4 : 3}>Paid {totals.paid} · Unpaid {totals.pending}</td></tr></tfoot>
            </table></div>}
        </Card>

        <Modal open={Boolean(selectedSalary)} title="Delete Salary Record" onClose={() => deleting ? null : setSelectedSalary(null)} className="max-w-lg">
            {selectedSalary ? <form className="grid gap-5" onSubmit={deleteSalary}>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
                    <p className="font-semibold">Permanently delete this salary record?</p>
                    <p className="mt-1 text-sm">{selectedSalary.employee?.name || selectedSalary.employeeId} · {monthName(selectedSalary.month)} {selectedSalary.year} · Net {formatCurrency(netFor(selectedSalary))}</p>
                    <p className="mt-2 text-xs">This removes the saved payroll and it will no longer appear in reports or salary slips. Login password is required.</p>
                </div>
                <Field label="Login Password"><div className="relative"><Input autoComplete="current-password" type={showDeletePassword ? "text" : "password"} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} required className="pr-11"/><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowDeletePassword((visible) => !visible)} aria-label={showDeletePassword ? "Hide password" : "Show password"}>{showDeletePassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" type="button" onClick={() => setSelectedSalary(null)} disabled={deleting}>Cancel</Button><Button variant="danger" type="submit" disabled={!deletePassword || deleting}><Trash2 className="h-4 w-4"/>{deleting ? "Deleting…" : "Delete Salary"}</Button></div>
            </form> : null}
        </Modal>
    </div>;
}

function Metric({ label, value, tone = "" }) { return <div className="rounded-xl border border-border bg-card p-5 shadow-soft"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p></div>; }

function reportDataFor(salary) { return parseEsslSalaryNote(salary.notes); }
function grossFor(salary) { return Number(reportDataFor(salary)?.gross ?? (Number(salary.baseSalary || 0) + Number(salary.bonus || 0))); }
function basePayAfterAttendanceFor(salary) {
    const payroll = reportDataFor(salary);
    if (!payroll) return 0;
    const basePay = Number(payroll.baseSalaryEarnings ?? (Number(payroll.schoolDayEarnings || 0) + Number(payroll.clSalary || 0) + Number(payroll.clHalfSalary || 0)));
    if (Number(payroll.salaryPolicyVersion) >= 3) return basePay;
    const attendanceDeductions = Number(payroll.attendanceDeductions ?? (Number(payroll.absenceDeduction || 0) + Number(payroll.halfDayDeduction || 0)));
    return Number(payroll.baseSalaryAfterAttendanceDeductions ?? Math.max(0, basePay - attendanceDeductions));
}
function deductionsFor(salary) { return Number(reportDataFor(salary)?.deductions ?? salary.totalDeduction ?? 0); }
function netFor(salary) { return Number(reportDataFor(salary)?.netSalary ?? salary.netSalary ?? 0); }
