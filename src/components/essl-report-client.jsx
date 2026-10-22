"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Select, Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { monthName, cn } from "@/lib/utils";
import { ClipboardList, Eye } from "lucide-react";

export function EsslReportClient() {
    const { notify } = useToast();
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [branchFilter, setBranchFilter] = useState("All");
    const [holidays, setHolidays] = useState("");
    const [savingHolidays, setSavingHolidays] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [lastUpdated, setLastUpdated] = useState(null);
    const [syncStatus, setSyncStatus] = useState("");

    async function loadHolidays() {
        try {
            const res = await fetch(`/api/essl/holidays?month=${month}&year=${year}`);
            const data = await res.json();
            setHolidays(data.holidays || "");
        } catch (error) {
            console.error("Failed to load holidays:", error);
        }
    }

    async function saveHolidays(newHolidays) {
        setSavingHolidays(true);
        try {
            const response = await fetch(`/api/essl/holidays`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, year, holidays: newHolidays })
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message || "Holiday dates could not be saved.");
            notify({ tone: "success", title: "Holiday dates saved", description: `${monthName(Number(month))} ${year}` });
        } catch (error) {
            console.error("Failed to save holidays:", error);
            notify({ tone: "error", title: error.message || "Holiday dates could not be saved" });
        } finally {
            setSavingHolidays(false);
        }
    }

    async function fetchReport({ silent = false } = {}) {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`/api/essl/report?month=${month}&year=${year}&branch=${encodeURIComponent(branchFilter)}&holidays=${encodeURIComponent(holidays)}`, { cache: "no-store" });
            const data = await res.json();
            if (data.success) {
                setReport(data.report || []);
                setLastUpdated(new Date());
                const latest = data.diagnostics?.latestPunch;
                setSyncStatus(`Biometric machine sent ${data.diagnostics?.logsReceived ?? 0} punches${latest ? ` · latest ${latest}` : ""}`);
            } else {
                setSyncStatus(data.message || "Failed to fetch report");
                if (!silent) notify({ tone: "error", title: data.message || "Failed to fetch report" });
            }
        } catch (error) {
            console.error(error);
            if (!silent) notify({ tone: "error", title: "Error fetching report" });
        } finally {
            if (!silent) setLoading(false);
        }
    }

    useEffect(() => {
        loadHolidays();
    }, [month, year]);

    useEffect(() => {
        if (!loading) {
            fetchReport();
        }
    }, [month, year, holidays, branchFilter]);

    useEffect(() => {
        const timer = window.setInterval(() => fetchReport({ silent: true }), 15_000);
        return () => window.clearInterval(timer);
    }, [month, year, holidays, branchFilter]);

    function openDetails(emp) {
        setSelectedEmployee(emp);
        setModalOpen(true);
    }

    const departmentOptions = useMemo(() => {
        const set = new Set([
            "Construction & Site",
            "Engineering & Design",
            "Accounts & Finance",
            "Sales & Marketing",
            "Administration / HR",
            "Security & Maintenance",
            "General"
        ]);
        report.forEach((emp) => {
            if (emp.department) set.add(emp.department);
        });
        return Array.from(set);
    }, [report]);

    const filteredAndSortedReport = useMemo(() => {
        return report
            .filter((emp) => {
                const matchesSearch = `${emp.name} ${emp.department || ""} ${emp.role || ""} ${emp.branch || ""} ${emp.esslId || ""}`.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesDepartment = departmentFilter === "All" || (emp.department || "General").toLowerCase() === departmentFilter.toLowerCase();
                const matchesBranch = branchFilter === "All" || (emp.branch || "Branch 1") === branchFilter;
                return matchesSearch && matchesDepartment && matchesBranch;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [report, searchQuery, departmentFilter, branchFilter]);

    return (
        <div className="space-y-6">
            <PageHeading 
                title="KM BUILDERS · Biometric Attendance Report" 
                description="Live attendance report from Branch 1 & Branch 2 biometric machines" 
            />

            <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-950 dark:border-white/10">
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
                    <Field label="Month">
                        <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>{monthName(m)}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Year">
                        <Select value={year} onChange={(e) => setYear(e.target.value)}>
                            {[2024, 2025, 2026, 2027].map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Branch">
                        <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                            <option value="All">All Branches</option>
                            <option value="Branch 1">Branch 1 (Head Office)</option>
                            <option value="Branch 2">Branch 2 (Site Office)</option>
                        </Select>
                    </Field>
                    <Field label="Department">
                        <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                            <option value="All">All Departments</option>
                            {departmentOptions.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label={`Holiday Dates (${savingHolidays ? "Saving..." : "Saved"})`}>
                        <Input 
                            value={holidays} 
                            onChange={(e) => setHolidays(e.target.value)} 
                            onBlur={(e) => saveHolidays(e.target.value)}
                            placeholder="e.g. 5, 15, 26"
                            className="w-48"
                        />
                    </Field>
                    <Field label="Search Employee">
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, ID..."
                            className="w-48"
                        />
                    </Field>
                    <div className="flex items-end pb-1">
                        <Button onClick={fetchReport} disabled={loading}>
                            {loading ? "Syncing..." : "Sync Logs"}
                        </Button>
                    </div>
                    <div className="flex items-end pb-1 text-xs text-muted-foreground">
                        {lastUpdated ? `Live refresh · Updated ${lastUpdated.toLocaleTimeString()} · ${syncStatus}` : (syncStatus || "Connecting to live attendance...")}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Employee</th>
                                <th className="px-4 py-3 font-semibold">Branch</th>
                                <th className="px-4 py-3 font-semibold">Biometric ID</th>
                                <th className="px-4 py-3 font-semibold text-center">Total Working Days</th>
                                <th className="px-4 py-3 font-semibold text-center">Days Present</th>
                                <th className="px-4 py-3 font-semibold text-center">Attendance %</th>
                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredAndSortedReport.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
                                        No data found. Make sure you have mapped Biometric Machine IDs in employee profiles, or clear search filter.
                                    </td>
                                </tr>
                            )}
                            {filteredAndSortedReport.map((emp) => (
                                <tr key={emp.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground">{emp.role} • {emp.department || "General"}</p>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={cn(
                                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                                            emp.branch === "Branch 2"
                                                ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-300"
                                                : "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300"
                                        )}>
                                            {emp.branch || "Branch 1"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium">{emp.esslId}</td>
                                    <td className="px-4 py-3 text-center font-medium">{emp.totalWorkingDays}</td>
                                    <td className="px-4 py-3 text-center">
                                        <p className="font-semibold text-blue-600 dark:text-blue-400">{emp.daysPresent}</p>
                                        {(emp.halfDaysCount > 0 || emp.fullDaysCount > 0) && (
                                            <p className="text-[11px] text-muted-foreground">
                                                {emp.fullDaysCount} Full{emp.halfDaysCount > 0 ? ` • ${emp.halfDaysCount} Half` : ""}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-800">
                                                <div 
                                                    className={`h-full ${emp.percentage >= 75 ? 'bg-green-500' : emp.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                                    style={{ width: `${emp.percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium">{emp.percentage}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button size="sm" variant="outline" onClick={() => openDetails(emp)}>
                                            <Eye className="h-4 w-4 mr-1" />
                                            View Logs
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal open={modalOpen} title={`Attendance Details - ${selectedEmployee?.name}`} onClose={() => setModalOpen(false)} className="max-w-4xl">
                {selectedEmployee && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-white/10">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Working Days</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedEmployee.totalWorkingDays}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Days Present</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedEmployee.daysPresent}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Breakdown</p>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                                    <span className="text-green-600 font-semibold">{selectedEmployee.fullDaysCount || 0}</span> Full · <span className="text-amber-600 font-semibold">{selectedEmployee.halfDaysCount || 0}</span> Half · <span className="text-slate-500 font-semibold">{selectedEmployee.absentDaysCount || 0}</span> Absent
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Duty Policy</p>
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1">
                                    {selectedEmployee.department || "Employee"}: <span className="font-semibold">{selectedEmployee.requiredHours}h</span> duty
                                    <span className="block text-[11px] text-muted-foreground">Half day if ≤ {selectedEmployee.halfDayThreshold}h</span>
                                </p>
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-[60vh] border rounded-lg">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 sticky top-0 z-10 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold">Date</th>
                                        <th className="px-4 py-2 font-semibold">Day</th>
                                        <th className="px-4 py-2 font-semibold text-center">Status</th>
                                        <th className="px-4 py-2 font-semibold">Working Hours</th>
                                        <th className="px-4 py-2 font-semibold">Punch Records</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedEmployee.attendanceRecord.map((record) => (
                                        <tr key={record.date} className={record.isSunday ? "bg-red-50/40 dark:bg-red-950/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}>
                                            <td className="px-4 py-2 font-medium">{record.date.split("-").reverse().join("/")}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{record.dayName}</td>
                                            <td className="px-4 py-2 text-center">
                                                {record.status === "Sunday" ? (
                                                    <span className="text-red-500 font-medium text-xs">Sunday</span>
                                                ) : record.status === "Holiday" ? (
                                                    <span className="text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded text-xs dark:bg-blue-900/30 dark:text-blue-300">Holiday</span>
                                                ) : record.status === "Present" ? (
                                                    <span className="text-emerald-700 font-semibold bg-emerald-100 px-2 py-1 rounded-md text-xs dark:bg-emerald-900/40 dark:text-emerald-300">Full Day</span>
                                                ) : record.status === "Half Day" ? (
                                                    <span className="text-amber-800 font-semibold bg-amber-100 px-2 py-1 rounded-md text-xs dark:bg-amber-900/40 dark:text-amber-300">Half Day (0.5)</span>
                                                ) : (
                                                    <span className="text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded-md text-xs dark:bg-slate-800 dark:text-slate-400">Absent</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 font-medium">
                                                {record.workedDurationText !== "-" ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                                        Number(record.workedMinutes ?? Number(record.workedHours || 0) * 60) > Number(selectedEmployee.halfDayThreshold || 0) * 60
                                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                                    }`}>
                                                        {record.workedDurationText}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground opacity-50">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-xs">
                                                {record.punches.length > 0 ? (
                                                    <div className="flex gap-1.5 flex-wrap items-center">
                                                        {record.punches.map((p, i) => (
                                                            <span 
                                                                key={i} 
                                                                className={`px-2 py-0.5 rounded ${
                                                                    i === 0 
                                                                        ? "bg-sky-100 text-sky-800 font-semibold dark:bg-sky-900/40 dark:text-sky-300" 
                                                                        : i === record.punches.length - 1 && record.punches.length > 1
                                                                        ? "bg-indigo-100 text-indigo-800 font-semibold dark:bg-indigo-900/40 dark:text-indigo-300"
                                                                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                }`}
                                                                title={i === 0 ? "First Punch (In)" : (i === record.punches.length - 1 ? "Last Punch (Out)" : `Punch #${i + 1}`)}
                                                            >
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground opacity-50">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
