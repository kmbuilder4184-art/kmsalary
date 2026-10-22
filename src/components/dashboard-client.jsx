"use client";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Banknote, CalendarClock, Camera, CheckCircle2, IndianRupee, Users, UserRoundX, ArrowUpRight, Clock3, Database, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { PageHeading } from "@/components/page-heading";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, monthName } from "@/lib/utils";
export function DashboardClient() {
    const { notify } = useToast();
    const [employees, setEmployees] = useState([]);
    const [salaries, setSalaries] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [monthAttendance, setMonthAttendance] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    });
    const [attendanceMonthKey, setAttendanceMonthKey] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    });
    const [lateBoundary, setLateBoundary] = useState("07:30");
    const [latePolicyLoaded, setLatePolicyLoaded] = useState(false);
    const lateBoundarySavedRef = useRef("07:30");
    const latestLateBoundaryRef = useRef(lateBoundary);
    latestLateBoundaryRef.current = lateBoundary;
    const [showLateEmployees, setShowLateEmployees] = useState(false);
    const [machineSyncInfo, setMachineSyncInfo] = useState({ lastSyncedAt: null, latestPunch: null, stale: false, snapshotSaved: null });
    const [punchEventType, setPunchEventType] = useState("Arrival");
    const [salaryPeriod, setSalaryPeriod] = useState("Month");
    const [salaryMonth, setSalaryMonth] = useState(String(new Date().getMonth() + 1));
    const [salaryYear, setSalaryYear] = useState(String(new Date().getFullYear()));
    const profilePhotoRef = useRef(null);
    const attendanceChartRef = useRef(null);
    useEffect(() => {
        async function load() {
            setLoading(true);
            const [employeeResponse, salaryResponse, userResponse] = await Promise.all([
                fetch("/api/employees?fields=summary", { cache: "no-store" }),
                fetch("/api/salaries?fields=summary", { cache: "no-store" }),
                fetch("/api/auth/me", { cache: "no-store" })
            ]);
            const [employeeData, salaryData, userData] = await Promise.all([
                employeeResponse.ok ? employeeResponse.json() : { employees: [] },
                salaryResponse.ok ? salaryResponse.json() : { salaries: [] },
                userResponse.ok ? userResponse.json() : { user: null }
            ]);
            setEmployees(employeeData.employees || []);
            setSalaries(salaryData.salaries || []);
            setCurrentUser(userData.user || null);
            setLoading(false);
        }
        load();
    }, []);
    useEffect(() => {
        let active = true;
        fetch("/api/settings/attendance-policy", { cache: "no-store" })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                if (!active) return;
                const savedBoundary = data?.lateArrivalBoundary || "07:30";
                lateBoundarySavedRef.current = savedBoundary;
                setLateBoundary(savedBoundary);
                setLatePolicyLoaded(true);
            })
            .catch(() => {});
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!latePolicyLoaded || lateBoundary === lateBoundarySavedRef.current) return undefined;
        const timer = window.setTimeout(() => {
            fetch("/api/settings/attendance-policy", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lateArrivalBoundary: lateBoundary })
            }).then(async (response) => {
                const data = await response.json().catch(() => null);
                if (!response.ok) throw new Error(data?.message || "Late-arrival cutoff could not be saved.");
                if (latestLateBoundaryRef.current !== lateBoundary) return;
                lateBoundarySavedRef.current = lateBoundary;
                notify({ tone: "success", title: "Attendance cutoff saved", description: `Late arrival after ${lateBoundary}` });
            }).catch((error) => {
                if (latestLateBoundaryRef.current === lateBoundary) notify({ tone: "error", title: error.message || "Late-arrival cutoff could not be saved" });
            });
        }, 400);
        return () => window.clearTimeout(timer);
    }, [lateBoundary, latePolicyLoaded, notify]);
    useEffect(() => {
        let active = true;
        let requestInProgress = false;
        async function loadTodayAttendance() {
            if (requestInProgress) return;
            requestInProgress = true;
            try {
                const now = new Date();
                const month = now.getMonth() + 1;
                const year = now.getFullYear();
                const [reportResponse, employeeResponse] = await Promise.all([
                    fetch(`/api/essl/report?month=${month}&year=${year}`, { cache: "no-store" }),
                    fetch("/api/employees?includePhoto=1", { cache: "no-store" })
                ]);
                const [reportData, employeeData] = await Promise.all([
                    reportResponse.ok ? reportResponse.json() : null,
                    employeeResponse.ok ? employeeResponse.json() : null
                ]);
                if (!active || !reportData?.success) return;
                setMachineSyncInfo({
                    lastSyncedAt: reportData.lastSyncedAt || null,
                    latestPunch: reportData.latestPunch || reportData.diagnostics?.latestPunch || null,
                    stale: Boolean(reportData.stale),
                    snapshotSaved: reportData.snapshotSaved !== false
                });
                const today = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                setMonthAttendance(reportData.report || []);
                setAttendanceMonthKey(`${year}-${String(month).padStart(2, "0")}`);
                setAttendanceDate((current) => current.startsWith(`${year}-${String(month).padStart(2, "0")}-`) ? current : today);
                setAbsentPhotos(Object.fromEntries((employeeData?.employees || []).map((employee) => [employee.employeeId, employee.photo || ""])));
            } catch (error) {
                console.error("Failed to load today's attendance:", error);
            } finally {
                requestInProgress = false;
            }
        }
        loadTodayAttendance();
        const timer = window.setInterval(loadTodayAttendance, 30_000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);
    const [absentPhotos, setAbsentPhotos] = useState({});
    const absentForSelectedDate = useMemo(() => monthAttendance.flatMap((employee) => {
        const record = employee.attendanceRecord?.find((item) => item.date === attendanceDate);
        if (record?.status !== "Absent") return [];
        return [{ ...employee, photo: absentPhotos[employee.employeeId] || "" }];
    }), [monthAttendance, attendanceDate, absentPhotos]);
    const filteredPunchEvents = useMemo(() => monthAttendance.flatMap((employee) => {
        const dateRecord = employee.attendanceRecord?.find((record) => record.date === attendanceDate);
        const punches = dateRecord?.punches || [];
        if (!punches.length) return [];
        const makeEvent = (type, time) => ({ employeeId: employee.employeeId, name: employee.name, date: dateRecord.date, type, time, minutes: timeToMinutes(time), dutyMinutes: type === "Departure" ? Number(dateRecord.workedMinutes || 0) : 0 });
        return [makeEvent("Arrival", punches[0]), ...(punches.length > 1 ? [makeEvent("Departure", punches[punches.length - 1])] : [])];
    })
        .filter((event) => event.type === punchEventType && Number.isFinite(event.minutes))
        .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name)), [monthAttendance, attendanceDate, punchEventType]);
    const lateEmployees = useMemo(() => {
        const boundary = timeToMinutes(lateBoundary);
        if (!Number.isFinite(boundary)) return [];
        const today = new Date();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        const cutoffDate = attendanceMonthKey === currentMonthKey
            ? `${attendanceMonthKey}-${String(today.getDate()).padStart(2, "0")}`
            : `${attendanceMonthKey}-${String(new Date(Number(attendanceMonthKey.slice(0, 4)), Number(attendanceMonthKey.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
        return monthAttendance.map((employee) => {
            const lateDays = (employee.attendanceRecord || []).filter((record) => {
                const punches = record.punches || [];
                return record.date.startsWith(`${attendanceMonthKey}-`) && record.date <= cutoffDate && !record.isSunday && record.status !== "Holiday" && punches.length > 0 && timeToMinutes(punches[0]) > boundary;
            }).map((record) => ({ date: record.date, time: record.punches[0] }));
            return { ...employee, lateDays };
        }).filter((employee) => employee.lateDays.length).sort((a, b) => b.lateDays.length - a.lateDays.length || a.name.localeCompare(b.name));
    }, [monthAttendance, lateBoundary, attendanceMonthKey]);
    async function changeProfilePhoto(event) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            const photo = await resizeProfileImage(file);
            const response = await fetch("/api/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photo })
            });
            const data = await response.json().catch(() => null);
            if (response.ok) {
                setCurrentUser((user) => ({ ...user, profilePhoto: photo }));
                notify({ tone: "success", title: "फोटो सफलतापूर्वक लग गई।" });
            }
            else {
                notify({ tone: "error", title: data?.message || "फोटो सेव नहीं हो पाई।" });
            }
        }
        catch {
            notify({ tone: "error", title: "कृपया सही फोटो चुनें।" });
        }
        event.target.value = "";
    }
    const availableYears = useMemo(() => {
        const years = new Set([new Date().getFullYear()]);
        salaries.forEach((salary) => years.add(salary.year));
        return Array.from(years).sort((a, b) => b - a);
    }, [salaries]);
    const filteredSalaries = useMemo(() => {
        return salaries.filter((salary) => {
            const matchesYear = salary.year === Number(salaryYear);
            const matchesMonth = salary.month === Number(salaryMonth);
            return salaryPeriod === "Year" ? matchesYear : matchesYear && matchesMonth;
        });
    }, [salaries, salaryMonth, salaryPeriod, salaryYear]);
    const periodLabel = salaryPeriod === "Year"
        ? salaryYear
        : `${monthName(Number(salaryMonth))} ${salaryYear}`;
    const stats = useMemo(() => {
        const activeEmployees = employees.filter((employee) => employee.status === "Active").length;
        const paid = filteredSalaries.filter((salary) => salary.status === "Paid");
        const pending = filteredSalaries.filter((salary) => salary.status === "Pending");
        const payrollTotal = filteredSalaries.reduce((sum, salary) => sum + salary.netSalary, 0);
        return [
            { label: "Active Staff", value: activeEmployees, icon: Users, tone: "text-teal-600" },
            { label: "Paid Slips", value: paid.length, icon: CheckCircle2, tone: "text-emerald-600" },
            { label: "Pending Slips", value: pending.length, icon: CalendarClock, tone: "text-amber-500" },
            { label: "Payroll Value", value: formatCurrency(payrollTotal), icon: IndianRupee, tone: "text-amber-600" }
        ];
    }, [employees, filteredSalaries]);
    const recentSalaries = salaries.slice(0, 7);
    const salaryRows = useMemo(() => {
        return filteredSalaries
            .sort((first, second) => first.netSalary - second.netSalary || String(first.employee?.name || first.employeeId).localeCompare(String(second.employee?.name || second.employeeId), "en", { sensitivity: "base" }));
    }, [filteredSalaries]);
    const highestSalary = salaryRows.at(-1);
    const maxSalary = Math.max(...salaryRows.map((salary) => salary.netSalary), 0);
    const adminName = currentUser?.name || "Administrator";
    return (<>
      <GreetingClock user={currentUser} />
      <PageHeading title="Dashboard" description="A controlled view of employee payroll, pending salary runs, and recent slips for KM Builders." action={<Link href="/essl-salary">
            <Button>
              <Banknote className="h-4 w-4"/>
              Generate Salary
          </Button>
          </Link>}/>

      <section className={`mb-6 overflow-hidden rounded-xl border p-4 shadow-sm ${machineSyncInfo.stale ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20" : "border-sky-200 bg-white dark:border-sky-900/50 dark:bg-slate-900/60"}`} aria-label="Biometric machine sync status" aria-live="polite">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${machineSyncInfo.stale ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"}`}>
              {machineSyncInfo.stale ? <WifiOff className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-slate-100">Biometric Machine Sync</h2>
                <Badge tone={machineSyncInfo.stale ? "warning" : "success"}>{machineSyncInfo.stale ? "Saved snapshot" : "Connected / latest data"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Last sync: {machineSyncInfo.lastSyncedAt ? new Date(machineSyncInfo.lastSyncedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "No successful sync recorded yet"}
              </p>
              {machineSyncInfo.stale && <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">Machine data is unavailable right now; showing the last saved attendance snapshot.</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
            {machineSyncInfo.latestPunch && <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />Latest punch: {new Date(machineSyncInfo.latestPunch).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>}
            {machineSyncInfo.snapshotSaved !== null && <span className={`inline-flex items-center gap-2 ${machineSyncInfo.snapshotSaved ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}><Database className="h-4 w-4" />{machineSyncInfo.snapshotSaved ? "Snapshot saved in Supabase" : "Snapshot save failed"}</span>}
            <Link href="/essl-salary-report" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">Open Biometric report <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-blue-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative shrink-0">
              {currentUser?.profilePhoto ? (<img src={currentUser.profilePhoto} alt="" className="h-20 w-20 rounded-full border-4 border-white dark:border-slate-800 object-cover shadow-md ring-2 ring-blue-200 dark:ring-blue-900/50"/>) : (<div className="grid h-20 w-20 rounded-full border-4 border-white dark:border-slate-800 bg-blue-50 dark:bg-slate-800 text-xl font-bold text-blue-700 dark:text-blue-400 shadow-md ring-2 ring-blue-200 dark:ring-blue-900/50">
                  <span className="m-auto">{adminName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                </div>)}
              <button type="button" onClick={() => profilePhotoRef.current?.click()} className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border border-blue-200 bg-blue-600 text-white shadow-sm transition hover:scale-105 hover:bg-blue-700 dark:border-blue-800 dark:bg-blue-500" aria-label="Change admin photo">
                <Camera className="h-4 w-4"/>
              </button>
              <input ref={profilePhotoRef} className="sr-only" type="file" accept="image/*" onChange={changeProfilePhoto}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Administrative Login</p>
              <h2 className="truncate text-2xl font-extrabold text-slate-950 dark:text-slate-50">Welcome, {adminName}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">आपका डैशबोर्ड उपयोग के लिए तैयार है।</p>
            </div>
          </div>
          <div className="admin-quote-marquee rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-slate-800/40">
            <span>{adminName} जी, आपका स्वागत है। गुणवत्ता, अनुशासन और ईमानदार कार्य से ही संस्थान की प्रगति होती है।</span>
          </div>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm dark:border-rose-900/60 dark:bg-slate-900/60" aria-label="Absent Employee Today">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-5 py-3 dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center gap-2">
            <UserRoundX className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h2 className="font-bold text-rose-800 dark:text-rose-200">Absent Employees · {attendanceDate.split("-").reverse().join("/")}</h2>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">{absentForSelectedDate.length}</span>
          </div>
        </div>
        <div className="relative h-28 overflow-hidden px-4">
          {absentForSelectedDate.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No absent employees on {attendanceDate.split("-").reverse().join("/")}</div>
          ) : (
            <div className="absent-employee-ticker absolute inset-x-0 top-0 flex flex-col gap-2 px-4 py-3 hover:[animation-play-state:paused]">
              {[...absentForSelectedDate, ...absentForSelectedDate].map((employee, index) => (
                <div key={`${employee.employeeId}-${index}`} className="flex min-h-16 items-center gap-3 rounded-lg border border-rose-100 bg-white/80 px-3 py-2 dark:border-rose-900/40 dark:bg-slate-950/60">
                  {employee.photo ? <img src={employee.photo} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-rose-100 object-cover dark:border-rose-900" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-100 text-sm font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">{employee.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{employee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{employee.department || "Employee"} · {employee.employeeId}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">Absent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60" aria-label="Today's employee arrival and departure graph">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Date-wise Attendance Timeline</h2>
            <p className="mt-1 text-xs text-muted-foreground">Employee punches ordered by time · current month</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Attendance graph date" type="date" min={`${attendanceMonthKey}-01`} max={`${attendanceMonthKey}-${String(new Date(Number(attendanceMonthKey.slice(0, 4)), Number(attendanceMonthKey.slice(5, 7)), 0).getDate()).padStart(2, "0")}`} value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="w-auto" />
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Attendance event type">
              {["Arrival", "Departure"].map((type) => (
                <button key={type} type="button" onClick={() => setPunchEventType(type)} className={`rounded-md px-4 py-2 text-sm font-semibold transition ${punchEventType === type ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"}`} aria-pressed={punchEventType === type}>{type}</button>
              ))}
            </div>
          </div>
        </div>
        {filteredPunchEvents.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No {punchEventType.toLowerCase()} punches recorded on {attendanceDate}.</div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Punch time · Y axis</p>
              <p className="text-xs text-muted-foreground">Employee · X axis</p>
            </div>
            <div className="flex min-w-0">
              <div className="relative w-12 shrink-0 sm:w-14">
                <div className="absolute inset-x-0 top-0 bottom-[58px]">
                  {[24, 18, 12, 6, 0].map((hour) => <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground sm:text-[11px]" style={{ top: `${((24 - hour) / 24) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}
                </div>
              </div>
              <div ref={attendanceChartRef} className="attendance-chart-scroll min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max">
                  {filteredPunchEvents.map((event) => {
                      const barHeight = Math.max((event.minutes / 1440) * 230, 3);
                      return (
                        <div key={`${event.employeeId}-${event.type}-${event.time}`} className="w-[96px] shrink-0 px-2 sm:w-[116px] sm:px-3">
                          <div className="relative h-[230px] border-b-2 border-l-2 border-slate-300 dark:border-slate-700">
                            {[25, 50, 75].map((line) => <div key={line} className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-slate-700" style={{ bottom: `${line}%` }} />)}
                            <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 dark:border-slate-700" />
                            <div className="absolute inset-x-0 bottom-0 flex justify-center" style={{ height: `${barHeight}px` }}>
                              <div className="group relative h-full w-10 rounded-t-lg bg-gradient-to-t from-blue-700 via-blue-600 to-sky-400 shadow-md shadow-blue-900/15 transition-all hover:w-12 hover:from-blue-800 hover:to-sky-300 sm:w-12">
                                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-blue-700 px-2 py-1 font-mono text-[10px] font-bold text-white shadow sm:text-[11px]">{formatPunchTime(event.time)}</span>
                                {punchEventType === "Departure" && <span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center text-center leading-tight text-white drop-shadow">
                                  <span className="text-[9px] font-semibold sm:text-[10px]">Duty hour</span>
                                  <span className="mt-0.5 text-[10px] font-extrabold sm:text-[11px]">{formatDuration(event.dutyMinutes)}</span>
                                </span>}
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 text-center" title={`${event.name} · ${event.employeeId}`}>
                            <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{event.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{event.employeeId}</p>
                          </div>
                        </div>
                      );
                  })}
                </div>
              </div>
            </div>
            {filteredPunchEvents.length > 5 && <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" onClick={() => attendanceChartRef.current?.scrollBy({ left: -320, behavior: "smooth" })} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/50" aria-label="Scroll graph left">←</button>
              <span className="text-xs text-muted-foreground">Scroll to view more employees</span>
              <button type="button" onClick={() => attendanceChartRef.current?.scrollBy({ left: 320, behavior: "smooth" })} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/50" aria-label="Scroll graph right">→</button>
            </div>}
          </div>
        )}
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/60 dark:bg-slate-900/60" aria-label="Monthly late arrivals">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-amber-600" /><h2 className="font-bold text-amber-900 dark:text-amber-200">Monthly Late Arrivals</h2><Badge tone="warning">{lateEmployees.length} employees</Badge></div>
          <div className="flex flex-wrap items-center gap-2"><label className="text-sm font-medium text-amber-900 dark:text-amber-200" htmlFor="late-boundary">Late after</label><Input id="late-boundary" type="time" value={lateBoundary} onChange={(event) => setLateBoundary(event.target.value)} className="w-auto bg-white" /><Button variant="secondary" onClick={() => setShowLateEmployees((value) => !value)}>{showLateEmployees ? "Hide" : "Show late employees"}</Button></div>
        </div>
        {showLateEmployees && <div className="max-h-96 overflow-auto p-4">
          {!lateEmployees.length ? <p className="py-6 text-center text-sm text-muted-foreground">No late arrivals after {lateBoundary} this month.</p> : <div className="space-y-2">{lateEmployees.map((employee) => <div key={employee.employeeId} className="rounded-lg border border-amber-100 p-3 dark:border-amber-900/40"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900 dark:text-slate-100">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.department || employee.category} · {employee.employeeId}</p></div><Badge tone="warning">{employee.lateDays.length} late {employee.lateDays.length === 1 ? "day" : "days"}</Badge></div><div className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-3">{employee.lateDays.map((day) => <span key={day.date}>{day.date.split("-").reverse().join("/")} · first punch {formatPunchTime(day.time)}</span>)}</div></div>)}</div>}
        </div>}
      </section>

      <section className="glass-panel relative mb-8 flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/20 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
        
        <div className="relative z-10 flex w-full flex-col items-center gap-6 sm:flex-row sm:items-stretch">
          <TiltPhoto images={["/km-building-exterior.jpg", "/km-office-interior.jpg"]} alt="KM Builders" />
          
          <div className="flex min-w-0 flex-1 flex-col justify-center py-2 text-center sm:text-left">
            <Badge className="mx-auto mb-3 w-fit sm:mx-0" variant="secondary">Premium Dashboard</Badge>
            <h2 className="bg-gradient-to-br from-primary to-blue-600 bg-clip-text pb-1 text-3xl font-black text-transparent drop-shadow-sm sm:text-4xl md:text-5xl">
              KM Builders
            </h2>
            <h2 className="mb-2 text-xl font-bold text-foreground/80 sm:text-2xl">Property Developers</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Modern payroll management with advanced CL tracking, dynamic filters, and beautifully branded salary workflows.
            </p>
            
            <div className="mt-6 flex w-fit flex-wrap justify-center gap-2 rounded-xl border border-white/20 bg-white/40 p-2 shadow-sm backdrop-blur-md dark:bg-white/5 sm:justify-start">
              <Select value={salaryPeriod} onChange={(event) => setSalaryPeriod(event.target.value)} className="w-28 bg-white/50 font-medium dark:bg-black/20">
                <option value="Month">Month</option>
                <option value="Year">Year</option>
              </Select>
              {salaryPeriod === "Month" ? (
                <Select value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} className="w-36 bg-white/50 font-medium dark:bg-black/20">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (<option key={month} value={String(month)}>{monthName(month)}</option>))}
                </Select>
              ) : null}
              <Select value={salaryYear} onChange={(event) => setSalaryYear(event.target.value)} className="w-24 bg-white/50 font-medium dark:bg-black/20">
                {availableYears.map((year) => (<option key={year} value={String(year)}>{year}</option>))}
              </Select>
            </div>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Showing payroll data for {periodLabel}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (<motion.section key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{loading ? "..." : stat.value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/50 bg-white/45 backdrop-blur dark:border-white/10 dark:bg-white/10">
                  <Icon className={`h-5 w-5 ${stat.tone}`}/>
                </div>
              </div>
            </motion.section>);
        })}
      </div>

      <Card className="mt-6">
        <CardHeader title="Salary Graph" description={`${periodLabel} ke employees low to high salary order me.`}/>
        {salaryRows.length === 0 ? (<EmptyState title={`No salary generated for ${periodLabel}`} description="Salary generate karne ke baad selected period ka employee graph yahan dikhega." action={<Link href="/essl-salary">
                <Button variant="secondary">Generate Salary</Button>
              </Link>}/>) : (<div className="grid gap-5 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/45 bg-white/45 p-4 dark:border-white/10 dark:bg-white/10">
                <p className="text-xs uppercase text-muted-foreground">Period</p>
                <p className="mt-1 font-semibold">{periodLabel}</p>
              </div>
              <div className="rounded-lg border border-white/45 bg-white/45 p-4 dark:border-white/10 dark:bg-white/10">
                <p className="text-xs uppercase text-muted-foreground">Salary Records</p>
                <p className="mt-1 font-semibold">{salaryRows.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <p className="text-xs uppercase text-emerald-700 dark:text-emerald-300">Highest Salary</p>
                <p className="mt-1 font-semibold">{highestSalary?.employee?.name || highestSalary?.employeeId} · {formatCurrency(highestSalary?.netSalary || 0)}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {salaryRows.map((salary) => {
                    const employeeName = salary.employee?.name || salary.employeeId;
                    const percent = maxSalary > 0 ? Math.max((salary.netSalary / maxSalary) * 100, 3) : 3;
                    const isHighest = salary._id === highestSalary?._id;
                    return (<div key={salary._id} className="grid gap-2 rounded-lg border border-white/45 bg-white/35 p-3 dark:border-white/10 dark:bg-white/10">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{employeeName}</p>
                        <p className="text-xs text-muted-foreground">{salary.employeeId} · {monthName(salary.month)} {salary.year}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {isHighest ? <Badge tone="success">Highest</Badge> : null}
                        <span>{formatCurrency(salary.netSalary)}</span>
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${isHighest ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${percent}%` }}/>
                    </div>
                  </div>);
                })}
            </div>
          </div>)}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Recent Salary Activity" description="Latest generated or updated salary records."/>
          {recentSalaries.length === 0 ? (<EmptyState title="No salary records yet" description="Generate the first salary slip from the Salary Calculator." action={<Link href="/essl-salary">
                  <Button variant="secondary">Open Salary Calculator</Button>
                </Link>}/>) : (<div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-white/35 text-xs uppercase text-muted-foreground dark:bg-white/10">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Month</th>
                    <th className="px-5 py-3 font-semibold">Net Salary</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentSalaries.map((salary) => (<tr key={salary._id} className="hover:bg-white/35 dark:hover:bg-white/10">
                      <td className="px-5 py-4">
                        <p className="font-medium">{salary.employee?.name || salary.employeeId}</p>
                        <p className="text-xs text-muted-foreground">{salary.employeeId}</p>
                      </td>
                      <td className="px-5 py-4">{monthName(salary.month)} {salary.year}</td>
                      <td className="px-5 py-4 font-semibold">{formatCurrency(salary.netSalary)}</td>
                      <td className="px-5 py-4">
                        <Badge tone={salary.status === "Paid" ? "success" : "danger"}>{salary.status}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Link className="text-primary hover:underline" href={`/slips/${salary._id}`}>
                          View
                        </Link>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </Card>

        <Card>
          <CardHeader title="Payment Status" description={`${periodLabel} payment status distribution.`}/>
          <div className="grid gap-4 p-5">
            <StatusBar label="Paid" value={filteredSalaries.filter((item) => item.status === "Paid").length} total={filteredSalaries.length} tone="bg-emerald-500"/>
            <StatusBar label="Pending" value={filteredSalaries.filter((item) => item.status === "Pending").length} total={filteredSalaries.length} tone="bg-amber-500"/>
            <div className="rounded-lg border border-white/45 bg-white/40 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10">
              <p className="text-sm font-semibold">School Payroll Office</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Salary slips include absence deduction, excess casual leave adjustment, advance recovery, payment status, and digital signature space.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>);
}
function StatusBar({ label, value, total, tone }) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (<div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }}/>
      </div>
    </div>);
}

function timeToMinutes(time) {
    const [hours, minutes] = String(time || "").split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN;
}

function formatPunchTime(time) {
    const [hours, minutes] = String(time || "").split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(totalMinutes) {
    const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function resizeProfileImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error("Invalid image"));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Image read failed"));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("Image load failed"));
            image.onload = () => {
                const size = 360;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext("2d");
                if (!context) {
                    reject(new Error("Canvas failed"));
                    return;
                }
                const scale = Math.max(size / image.width, size / image.height);
                const width = image.width * scale;
                const height = image.height * scale;
                context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.86));
            };
            image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

function TiltPhoto({ images, alt }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images]);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="relative h-48 w-full shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/30 shadow-2xl transition-shadow hover:shadow-primary/30 sm:h-64 sm:w-96"
    >
      <div 
        style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d" }}
        className="absolute inset-0"
      >
        <AnimatePresence mode="popLayout">
          <motion.img 
            key={currentIndex}
            src={images?.[currentIndex]} 
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            onError={(e) => { e.currentTarget.src = "/km-builders-logo.png" }}
            alt={alt} 
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-110"
          />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/20" />
      </div>
    </motion.div>
  );
}

function GreetingClock({ user }) {
  const [time, setTime] = useState(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return <div className="h-[88px] mb-6 rounded-2xl bg-muted/20 animate-pulse" />;

  const hour = time.getHours();
  let greeting = "Good Evening";
  let icon = "🌙";
  let gradient = "from-indigo-600 to-slate-900";
  let textGradient = "from-indigo-100 to-blue-50";

  if (hour >= 5 && hour < 12) {
    greeting = "Good Morning";
    icon = "🌅";
    gradient = "from-orange-500 to-amber-300";
    textGradient = "from-orange-950 to-amber-900";
  } else if (hour >= 12 && hour < 17) {
    greeting = "Good Afternoon";
    icon = "☀️";
    gradient = "from-blue-500 to-cyan-300";
    textGradient = "from-blue-950 to-cyan-900";
  } else if (hour >= 17 && hour < 22) {
    greeting = "Good Evening";
    icon = "🌇";
    gradient = "from-purple-600 to-indigo-500";
    textGradient = "from-purple-50 to-indigo-100";
  } else {
    greeting = "Late Night";
    icon = "✨";
    gradient = "from-slate-900 to-indigo-950";
    textGradient = "from-slate-200 to-indigo-100";
  }

  const formattedTime = time.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = time.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
      style={{ transformStyle: "preserve-3d" }}
      className={`relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-0.5 shadow-2xl`}
    >
      <div className="relative flex flex-col items-center justify-between gap-4 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-xl dark:bg-black/20 sm:flex-row">
        
        {/* Left: Greeting */}
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner backdrop-blur-md"
          >
            {icon}
          </motion.div>
          <div className="text-center sm:text-left">
            <h2 className={`text-2xl font-black bg-gradient-to-r ${textGradient} bg-clip-text text-transparent drop-shadow-sm`}>
              {greeting}, {user?.name || "Admin"}
            </h2>
            <p className="text-sm font-medium text-white/90 drop-shadow-sm">{user?.role || "System Administrator"}</p>
          </div>
        </div>

        {/* Right: Clock */}
        <div className="flex flex-col items-center sm:items-end">
          <div className="flex items-center gap-2 rounded-xl bg-black/20 px-4 py-2 shadow-inner backdrop-blur-md">
            <CalendarClock className="h-5 w-5 text-white/90" />
            <span className="font-mono text-xl font-bold tracking-widest text-white drop-shadow-md">
              {formattedTime}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/80">
            {formattedDate}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
