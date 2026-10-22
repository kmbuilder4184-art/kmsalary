"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Download, Fingerprint, GraduationCap, RefreshCw, Search, Users, XCircle, Plus, Pencil, Send } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { StudentPunchReport } from "@/components/student-punch-report";

const formatStudentName = (name) => String(name || "").toLocaleUpperCase("en");

const blankStudent = { biometricId: "", name: "", className: "", section: "", studentCode: "", guardianName: "", phone: "" };

function getSchoolDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

export function StudentAttendanceClient() {
    const { notify } = useToast();
    const today = getSchoolDateParts();
    const [dateFrom, setDateFrom] = useState(`${today.year}-${String(today.month).padStart(2, "0")}-01`);
    const [dateTo, setDateTo] = useState(`${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`);
    const [attendanceFilter, setAttendanceFilter] = useState("present");
    const [classFilter, setClassFilter] = useState("All");
    const [sectionFilter, setSectionFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [studentModalOpen, setStudentModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [studentForm, setStudentForm] = useState(blankStudent);
    const [savingStudent, setSavingStudent] = useState(false);
    const [sendingStudentId, setSendingStudentId] = useState("");
    const [notice, setNotice] = useState("");
    const [commandIdToCheck, setCommandIdToCheck] = useState("");
    const [checkingCommandStatus, setCheckingCommandStatus] = useState(false);
    const [commandStatusResult, setCommandStatusResult] = useState("");

    async function loadAttendance() {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/api/student-attendance?from=${dateFrom}&to=${dateTo}`, { cache: "no-store" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Student attendance load nahi ho saki.");
            setData(result);
        } catch (loadError) {
            setError(loadError.message || "Student attendance load nahi ho saki.");
        } finally {
            setLoading(false);
        }
    }

    function openNewStudent() {
        setEditingStudent(null);
        setStudentForm(blankStudent);
        setStudentModalOpen(true);
    }

    function openEditStudent(student) {
        setEditingStudent(student);
        setStudentForm({ biometricId: student.esslId, name: student.name, className: student.className, section: student.section, studentCode: student.studentCode, guardianName: student.guardianName, phone: student.phone });
        setStudentModalOpen(true);
    }

    async function sendStudentToMachine(studentId, { notifySuccess = true } = {}) {
        setSendingStudentId(studentId);
        setError("");
        setNotice("");
        try {
            const response = await fetch("/api/student-attendance/send-to-machine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.profileSaved ? `Profile saved in software, but machine send failed: ${result.message}` : (result.message || "Machine send failed."));
            const student = data?.students?.find((item) => item.id === studentId);
            const lastCommand = { commandId: String(result.commandId || ""), biometricId: String(result.biometricId || ""), name: student?.name || "Student" };
            setCommandIdToCheck(lastCommand.commandId);
            setCommandStatusResult("");
            if (lastCommand.commandId) window.localStorage.setItem("studentAttendanceLastEsslCommand", JSON.stringify(lastCommand));
            setNotice(`${result.message} ID: ${result.biometricId}${result.commandId ? ` · Command ${result.commandId}` : ""}`);
            if (notifySuccess) notify({ tone: "success", title: "Student sent to eSSL machine", description: `Machine ID: ${result.biometricId}${result.commandId ? ` · Command ${result.commandId}` : ""}` });
            return true;
        } catch (sendError) {
            setError(sendError.message || "Machine send failed.");
            notify({ tone: "error", title: sendError.message || "Student could not be sent to the machine" });
            return false;
        } finally {
            setSendingStudentId("");
        }
    }

    async function saveStudent(event) {
        event.preventDefault();
        setSavingStudent(true);
        setError("");
        try {
            const response = await fetch("/api/student-attendance", {
                method: editingStudent ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingStudent ? { id: editingStudent.id, student: studentForm } : studentForm)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Student save nahi hua.");
            setStudentModalOpen(false);
            await loadAttendance();
            const sent = await sendStudentToMachine(result.student.id, { notifySuccess: false });
            notify({
                tone: "success",
                title: sent ? "Student saved and sent to eSSL" : editingStudent ? "Student profile updated" : "Student profile saved",
                description: sent ? `Machine ID: ${result.student.esslId || studentForm.biometricId}` : "The profile is saved in the software. Check the machine-send message for details."
            });
        } catch (saveError) {
            setError(saveError.message || "Student save nahi hua.");
            notify({ tone: "error", title: saveError.message || "Student profile could not be saved" });
        } finally {
            setSavingStudent(false);
        }
    }

    async function checkCommandStatus(event) {
        event.preventDefault();
        setCheckingCommandStatus(true);
        setError("");
        setCommandStatusResult("");
        try {
            const response = await fetch("/api/student-attendance/command-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commandId: commandIdToCheck })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Command status nahi mil saka.");
            setCommandStatusResult(`eSSL command ${result.commandId} status: ${result.commandStatus} · Machine ${result.machineSerial}`);
        } catch (statusError) {
            setError(statusError.message || "Command status nahi mil saka.");
        } finally {
            setCheckingCommandStatus(false);
        }
    }

    useEffect(() => {
        if (dateFrom && dateTo && dateFrom <= dateTo) loadAttendance();
    }, [dateFrom, dateTo]);
    useEffect(() => {
        const initialDate = getSchoolDateParts();
        let lastDateKey = `${initialDate.year}-${initialDate.month}-${initialDate.day}`;
        const initialToday = `${initialDate.year}-${String(initialDate.month).padStart(2, "0")}-${String(initialDate.day).padStart(2, "0")}`;
        const initiallyShowingToday = dateTo === initialToday;

        const refreshAtDateChange = () => {
            const now = getSchoolDateParts();
            const dateKey = `${now.year}-${now.month}-${now.day}`;
            if (dateKey === lastDateKey) return;
            lastDateKey = dateKey;
            if (!initiallyShowingToday) return;
            setDateTo(`${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`);
        };

        const timer = window.setInterval(refreshAtDateChange, 30_000);
        document.addEventListener("visibilitychange", refreshAtDateChange);
        window.addEventListener("focus", refreshAtDateChange);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", refreshAtDateChange);
            window.removeEventListener("focus", refreshAtDateChange);
        };
    }, [dateTo]);
    useEffect(() => {
        try {
            const lastCommand = JSON.parse(window.localStorage.getItem("studentAttendanceLastEsslCommand") || "null");
            if (lastCommand?.commandId) setCommandIdToCheck(String(lastCommand.commandId));
        } catch {
            window.localStorage.removeItem("studentAttendanceLastEsslCommand");
        }
    }, []);

    const classOptions = ["Class 9", "Class 10", "Class 11", "Class 12"];
    const classStudents = (data?.students || []).filter((student) => classFilter === "All" || student.className === classFilter);
    const sectionOptions = [...new Set(classStudents.map((student) => student.section).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));
    const filteredStudents = useMemo(() => (data?.students || []).filter((student) => {
        const matchesClass = classFilter === "All" || student.className === classFilter;
        const matchesSection = sectionFilter === "All" || student.section === sectionFilter;
        const matchesSearch = `${student.name} ${student.studentCode} ${student.className} ${student.section} ${student.esslId}`.toLowerCase().includes(search.trim().toLowerCase());
        const presentInRange = student.presentDays > 0;
        const matchesAttendance = attendanceFilter === "all" || (attendanceFilter === "present" ? presentInRange : !presentInRange);
        return matchesClass && matchesSection && matchesSearch && matchesAttendance;
    }).sort(compareStudentNames), [data, attendanceFilter, classFilter, sectionFilter, search]);

    const todayPresentStudents = useMemo(() => (data?.students || []).filter((student) => {
        const matchesClass = classFilter === "All" || student.className === classFilter;
        const matchesSection = sectionFilter === "All" || student.section === sectionFilter;
        const matchesSearch = `${student.name} ${student.studentCode} ${student.className} ${student.section} ${student.esslId}`.toLowerCase().includes(search.trim().toLowerCase());
        return matchesClass && matchesSection && matchesSearch && (student.todayPunches || []).length > 0;
    }).map((student) => {
        const firstPunch = [...student.todayPunches].sort()[0];
        const [hour, minute] = firstPunch.split(":").map(Number);
        return { ...student, firstPunch, punchMinutes: hour * 60 + minute };
    }).sort((first, second) => first.punchMinutes - second.punchMinutes || compareStudentNames(first, second)), [data, classFilter, sectionFilter, search]);

    const todayAbsentStudents = useMemo(() => (data?.students || []).filter((student) => {
        const matchesClass = classFilter === "All" || student.className === classFilter;
        const matchesSection = sectionFilter === "All" || student.section === sectionFilter;
        const matchesSearch = `${student.name} ${student.studentCode} ${student.className} ${student.section} ${student.esslId}`.toLowerCase().includes(search.trim().toLowerCase());
        return matchesClass && matchesSection && matchesSearch && (student.todayPunches || []).length === 0;
    }).sort(compareStudentNames), [data, classFilter, sectionFilter, search]);

    const arrivalBuckets = useMemo(() => {
        if (!todayPresentStudents.length) return [];
        const slotMinutes = 30;
        const firstSlot = Math.floor(todayPresentStudents[0].punchMinutes / slotMinutes) * slotMinutes;
        const lastSlot = Math.floor(todayPresentStudents[todayPresentStudents.length - 1].punchMinutes / slotMinutes) * slotMinutes;
        const counts = new Map();
        for (const student of todayPresentStudents) {
            const slot = Math.floor(student.punchMinutes / slotMinutes) * slotMinutes;
            counts.set(slot, (counts.get(slot) || 0) + 1);
        }
        return Array.from({ length: Math.floor((lastSlot - firstSlot) / slotMinutes) + 1 }, (_, index) => {
            const start = firstSlot + index * slotMinutes;
            return { start, count: counts.get(start) || 0 };
        });
    }, [todayPresentStudents]);
    const maxArrivalBucketCount = Math.max(1, ...arrivalBuckets.map((bucket) => bucket.count));

    const studentProfiles = (data?.students || []).filter((student) => student.isStudent);
    const presentTotal = filteredStudents.filter((student) => student.isStudent).reduce((sum, student) => sum + student.presentDays, 0);
    const absentTotal = filteredStudents.filter((student) => student.isStudent).reduce((sum, student) => sum + student.absentDays, 0);

    function exportCsv() {
        const headings = ["Student Name", "Student Code", "Class", "Section", "Biometric ID", "Present Days", "Absent Days"];
        const lines = [headings, ...filteredStudents.map((student) => [formatStudentName(student.name), student.studentCode, student.className, student.section, student.esslId, student.presentDays, student.absentDays])];
        const csv = lines.map((line) => line.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `student-attendance-${dateFrom}-to-${dateTo}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    const dateRangeLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "Choose a valid date range";

    return <div className="space-y-6">
        <PageHeading title="Student Attendance" description="Student biometric attendance from the dedicated eSSL machine, grouped by class and listed alphabetically." action={<div className="flex gap-2"><Button variant="secondary" onClick={loadAttendance} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button><Button onClick={exportCsv} disabled={!filteredStudents.length}><Download className="h-4 w-4" />Export CSV</Button></div>} />

        <Card className="overflow-hidden border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:via-slate-950 dark:to-cyan-950/30">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-lg shadow-indigo-600/20"><Fingerprint className="h-6 w-6" /></div><div><p className="font-semibold text-slate-900 dark:text-white">Student biometric device</p><p className="text-sm text-slate-600 dark:text-slate-300">Serial number · <span className="font-mono font-semibold">{data?.machineSerial || "TBS2262000975"}</span></p></div></div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CalendarDays className="h-4 w-4" />{dateRangeLabel}{data?.daysShown ? ` · ${data.daysShown} days shown` : ""}{data?.syncedAt ? ` · Synced ${new Date(data.syncedAt).toLocaleString("en-IN")}` : ""}</div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-indigo-100 px-5 py-3 text-xs text-slate-600 dark:border-indigo-900/40 dark:text-slate-300"><span>Machine punches: <b>{data?.logsReceived ?? "—"}</b></span><span>Matched student users: <b>{data?.matchedStudentUsers ?? "—"}</b></span><span>Matched student punches: <b>{data?.matchedStudentPunches ?? "—"}</b></span>{data?.unmatchedMachineIds?.length ? <span>Unmatched IDs: <b>{data.unmatchedMachineIds.slice(0, 10).join(", ")}{data.unmatchedMachineIds.length > 10 ? "…" : ""}</b></span> : null}</div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={GraduationCap} label="Student profiles" value={studentProfiles.length} tone="indigo" />
            <SummaryCard icon={CheckCircle2} label="Present day entries" value={presentTotal} tone="emerald" />
            <SummaryCard icon={XCircle} label="Absent day entries" value={absentTotal} tone="rose" />
            <SummaryCard icon={Users} label="Classes" value={data?.classes?.length || 0} tone="cyan" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <div><p className="font-semibold text-slate-900 dark:text-white">Print attendance range report</p><p className="mt-1 text-sm text-muted-foreground">Includes every punch time with seconds for the selected dates and filters. Print dialog is set up for A4 paper.</p></div>
            <StudentPunchReport students={filteredStudents} fromDate={dateFrom} toDate={dateTo} className={classFilter} section={sectionFilter} attendanceFilter={attendanceFilter} />
        </div>

        <Card>
            <CardHeader title="Student details & attendance filters" description="Choose a date range to review attendance. Present students are shown by default; choose Absent or All to change the list." action={<Button onClick={openNewStudent}><Plus className="h-4 w-4" />Add Student</Button>} />
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
                <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-500"><span>From date</span><Input className="min-w-0" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} aria-label="Attendance from date" /></label>
                <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-500"><span>To date</span><Input className="min-w-0" type="date" value={dateTo} min={dateFrom || undefined} max={`${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`} onChange={(event) => setDateTo(event.target.value)} aria-label="Attendance to date" /></label>
                <Select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)} aria-label="Filter by attendance status in selected date range"><option value="present">Present in range</option><option value="absent">Absent in range</option><option value="all">All students</option></Select>
                <Select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSectionFilter("All"); }} aria-label="Filter by class"><option value="All">All classes (9–12)</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}</Select>
                <Select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} aria-label="Filter by section"><option value="All">All sections</option>{sectionOptions.map((section) => <option key={section} value={section}>Section {section}</option>)}</Select>
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search student name, ID or class" /></div>
            </div>
        </Card>

        <Card className={`overflow-hidden shadow-sm ${attendanceFilter === "absent" ? "border-rose-100 bg-gradient-to-br from-white via-white to-rose-50/60 dark:border-rose-900/40 dark:from-slate-950 dark:via-slate-950 dark:to-rose-950/20" : "border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/60 dark:border-emerald-900/40 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20"}`}>
            <CardHeader title={attendanceFilter === "absent" ? "Today's absent students" : "Today's student arrival"} description={attendanceFilter === "absent" ? "No biometric punch today · students sorted A to Z" : "Present students today · earliest punch first · time shown in 30-minute intervals"} action={<Badge tone={attendanceFilter === "absent" ? "danger" : "success"}>{attendanceFilter === "absent" ? todayAbsentStudents.length : todayPresentStudents.length} {attendanceFilter === "absent" ? "absent" : "present"}</Badge>} />
            {attendanceFilter === "absent" ? <>
                {data?.todayMachineError ? <div className="px-5 pb-5 text-sm text-rose-700 dark:text-rose-300">Today's device data could not be loaded: {data.todayMachineError}</div> : !data && loading ? <div className="px-5 pb-5 text-sm text-muted-foreground">Today's student punches load ho rahe hain…</div> : todayAbsentStudents.length === 0 ? <div className="px-5 pb-5 text-sm text-muted-foreground">No absent students match the selected class, section, and search filters.</div> : <div className="max-h-[440px] overflow-auto px-5 pb-5"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-rose-50 text-[11px] uppercase tracking-wide text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"><tr><th className="px-4 py-3 font-semibold">#</th><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 text-right font-semibold">Today's status</th></tr></thead><tbody>{todayAbsentStudents.map((student, index) => <tr key={student.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-3 text-xs tabular-nums text-slate-400">{index + 1}</td><td className="px-4 py-3"><span className="font-medium text-slate-800 dark:text-slate-100">{formatStudentName(student.name)}</span><span className="mt-0.5 block text-[11px] text-slate-400">{student.studentCode}</span></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{student.className}{student.section ? `-${student.section}` : ""}</td><td className="px-4 py-3 text-right"><span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Absent · No punch</span></td></tr>)}</tbody></table></div>}
            </> : !todayPresentStudents.length ? <div className="px-5 pb-5 text-sm text-muted-foreground">{!data && loading ? "Today's student punches load ho rahe hain…" : data?.todayMachineError ? `Today's device data could not be loaded: ${data.todayMachineError}` : "No student arrival punches found for today's date with the selected class, section, and search filters."}</div> : <div className="grid gap-5 p-5 pt-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60" aria-label="Student arrival count by time">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900 dark:text-white">Arrival graph</h3><p className="mt-1 text-xs text-muted-foreground">Students by first punch time</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">{data?.todayDate || "Today"}</span></div>
                    <div className="space-y-3">{arrivalBuckets.map((bucket) => {
                        const width = bucket.count ? Math.max(8, Math.round(bucket.count / maxArrivalBucketCount * 100)) : 0;
                        return <div key={bucket.start} className="grid grid-cols-[104px_minmax(0,1fr)_32px] items-center gap-3"><span className="text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">{formatClockMinutes(bucket.start)}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${width}%` }} /></div><span className="text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{bucket.count}</span></div>;
                    })}</div>
                    <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:border-slate-800"><span>Earlier</span><span>Later</span></div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60" aria-label="Today's present student punch details">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"><div><h3 className="font-semibold text-slate-900 dark:text-white">Today's present students</h3><p className="mt-1 text-xs text-muted-foreground">Sorted by first punch · earliest to latest</p></div><span className="text-xs font-semibold text-slate-500">{todayPresentStudents.length} records</span></div>
                    <div className="max-h-[360px] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-2.5 font-semibold">#</th><th className="px-4 py-2.5 font-semibold">Student</th><th className="px-4 py-2.5 font-semibold">Class</th><th className="px-4 py-2.5 text-right font-semibold">First punch</th></tr></thead><tbody>{todayPresentStudents.map((student, index) => <tr key={student.id} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800"><td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">{index + 1}</td><td className="px-4 py-2.5"><span className="font-medium text-slate-800 dark:text-slate-100">{formatStudentName(student.name)}</span><span className="mt-0.5 block text-[11px] text-slate-400">{student.studentCode}</span></td><td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{student.className}{student.section ? `-${student.section}` : ""}</td><td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatFirstPunch(student.firstPunch)}</td></tr>)}</tbody></table></div>
                </section>
            </div>}
        </Card>

        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">{notice ? <p>{notice}</p> : <p>Check whether eSSL processed a previously accepted command. Enter the command ID shown after sending (for Vijay, the earlier ID was 472).</p>}<form onSubmit={checkCommandStatus} className="flex flex-wrap items-center gap-2"><Input aria-label="eSSL command ID" inputMode="numeric" value={commandIdToCheck} onChange={(event) => setCommandIdToCheck(event.target.value)} placeholder="Command ID" className="max-w-48" required/><Button type="submit" variant="secondary" disabled={checkingCommandStatus || !commandIdToCheck}><RefreshCw className={`h-4 w-4 ${checkingCommandStatus ? "animate-spin" : ""}`} />{checkingCommandStatus ? "Checking…" : "Check machine status"}</Button></form>{commandStatusResult ? <p className="font-medium">{commandStatusResult}</p> : null}</div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
        <Card>
            <CardHeader title={`${attendanceFilter === "all" ? "All" : attendanceFilter === "present" ? "Present in Range" : "Absent in Range"} Student Details`} description={`${filteredStudents.length} students · names sorted A to Z · ${data?.matchedStudentPunches ?? 0} punches in selected range (${data?.logsReceived ?? 0} total machine punches)`} />
            <div className="p-0">
                {loading && !data ? <div className="p-10 text-center text-sm text-muted-foreground">Student attendance load ho rahi hai…</div> : error && !data ? <div className="p-10 text-center text-sm text-rose-700 dark:text-rose-300">{error}</div> : filteredStudents.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{data?.machineError ? `Student machine: ${data.machineError}. ` : ""}No {attendanceFilter} students match these filters. Try another attendance status, class, section, or search.</div> : <div className="space-y-4 p-4 sm:p-5">{filteredStudents.map((student) => <StudentCard key={student.id} student={student} onEdit={() => openEditStudent(student)} onSend={() => sendStudentToMachine(student.id)} sending={sendingStudentId === student.id} />)}</div>}
            </div>
        </Card>

        <Modal open={studentModalOpen} title={editingStudent ? "Edit Student Profile" : "Add Student Profile"} onClose={() => savingStudent ? null : setStudentModalOpen(false)} className="max-w-2xl">
            <form onSubmit={saveStudent} className="space-y-4">
                <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200">Basic profile machine server ko bheja jayega. Face/photo template yahan se transfer nahi hota; ID bhejne ke baad face machine par isi ID mein enroll karein.</div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Student ID / Machine Employee Code"><Input required value={studentForm.biometricId} onChange={(event) => setStudentForm({ ...studentForm, biometricId: event.target.value, studentCode: event.target.value })} placeholder="Unique ID to register on machine" /></Field>
                    <Field label="Student name"><Input required value={studentForm.name} onChange={(event) => setStudentForm({ ...studentForm, name: event.target.value })} /></Field>
                    <Field label="Class"><Select required value={studentForm.className} onChange={(event) => setStudentForm({ ...studentForm, className: event.target.value })}><option value="">Select class</option>{classOptions.map((className) => <option key={className} value={className}>{className}</option>)}</Select></Field>
                    <Field label="Section"><Input required value={studentForm.section} onChange={(event) => setStudentForm({ ...studentForm, section: event.target.value })} placeholder="e.g. A" /></Field>
                    <Field label="Admission / roll number (if different)"><Input value={studentForm.studentCode} onChange={(event) => setStudentForm({ ...studentForm, studentCode: event.target.value })} /></Field>
                    <Field label="Parent / guardian name"><Input value={studentForm.guardianName} onChange={(event) => setStudentForm({ ...studentForm, guardianName: event.target.value })} /></Field>
                    <Field label="Contact number"><Input value={studentForm.phone} onChange={(event) => setStudentForm({ ...studentForm, phone: event.target.value })} /></Field>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="secondary" onClick={() => setStudentModalOpen(false)}>Cancel</Button><Button type="submit" disabled={savingStudent || Boolean(sendingStudentId)}><Send className="h-4 w-4" />{savingStudent ? "Saving profile…" : editingStudent ? "Save & Send to Machine" : "Add & Send to Machine"}</Button></div>
            </form>
        </Modal>
    </div>;
}

function Field({ label, children }) {
    return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>;
}

function compareStudentNames(first, second) {
    return String(first.name || "").trim().localeCompare(String(second.name || "").trim(), "en", { sensitivity: "base", numeric: true });
}

function formatFirstPunch(value) {
    const [hourText = "0", minuteText = "00"] = String(value || "").split(":");
    const hour = Number(hourText);
    if (!Number.isFinite(hour)) return value;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${minuteText.padStart(2, "0")} ${period}`;
}

function formatClockMinutes(value) {
    const hours = Math.floor(value / 60) % 24;
    const minutes = value % 60;
    return formatFirstPunch(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
}

function SummaryCard({ icon: Icon, label, value, tone }) {
    const tones = { indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" };
    return <Card><div className="flex items-center gap-4 p-4"><div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p></div></div></Card>;
}

function StudentCard({ student, onEdit, onSend, sending }) {
    const present = student.presentDays;
    const total = student.attendance.length;
    const percentage = total ? Math.round((present / total) * 100) : 0;
    return <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow open:shadow-md dark:border-slate-800 dark:bg-slate-950">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-bold text-white">{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white">{formatStudentName(student.name)}</p><p className="truncate text-xs text-muted-foreground">{student.studentCode} · {student.className}{student.section ? `-${student.section}` : ""} · Machine ID: {student.esslId || "not mapped"}</p><p className="mt-1 text-[11px] text-muted-foreground">{student.hasBiometricMatch ? "Matched with machine punch" : "No matching punch for this month"}</p></div></div>
            <div className="flex items-center gap-2"><Badge tone="success">{present} present</Badge><Badge tone="danger">{student.absentDays} absent</Badge><div className="hidden w-20 text-right text-sm font-semibold text-slate-700 sm:block dark:text-slate-200">{percentage}%</div><Button variant="secondary" size="sm" disabled={sending} aria-label={`Send ${formatStudentName(student.name)} to machine`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSend(); }}><Send className="h-4 w-4" />{sending ? "Sending…" : "Send"}</Button><Button variant="ghost" size="icon" aria-label={`Edit ${formatStudentName(student.name)}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onEdit(); }}><Pencil className="h-4 w-4" /></Button><span className="ml-2 text-slate-400 transition-transform group-open:rotate-180">⌄</span></div>
        </summary>
        <div className="border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{student.guardianName ? `Parent: ${student.guardianName}` : "Student profile"}{student.phone ? ` · ${student.phone}` : ""} · Daily punches</span><span>{present}/{total} days · {percentage}%</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{student.attendance.map((day) => {
                const hasPunch = day.punches.length > 0;
                return <div key={day.date} className={`min-h-28 rounded-2xl border p-4 font-sans transition-colors ${hasPunch ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/70 shadow-sm shadow-emerald-900/5 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/20" : "border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${hasPunch ? "bg-white/80 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200" : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{day.date.slice(8, 10)}</span><span className="text-sm font-medium text-slate-600 dark:text-slate-300">{day.day}</span></div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${hasPunch ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" : "bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{day.status}</span>
                    </div>
                    <div className="mt-4">
                        {hasPunch ? <><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75 dark:text-emerald-300/75">First punch</p><p className="mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{formatFirstPunch(day.punches[0])}</p></> : <p className="pt-1 text-base font-medium tracking-tight text-slate-400 dark:text-slate-500">No punch</p>}
                    </div>
                </div>;
            })}</div>
        </div>
    </details>;
}
