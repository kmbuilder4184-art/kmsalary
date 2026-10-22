import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/server-auth";
import { decodeEsslXml, escapeEsslXml, getStudentEsslConfig } from "@/lib/essl-student-config";

export const dynamic = "force-dynamic";

const studentSchema = z.object({
    name: z.string().trim().min(1).max(120),
    studentCode: z.string().trim().max(40).optional().default(""),
    className: z.string().trim().min(1).max(60),
    section: z.string().trim().max(30).optional().default(""),
    guardianName: z.string().trim().max(120).optional().default(""),
    phone: z.string().trim().max(30).optional().default(""),
    biometricId: z.string().trim().min(1).max(80)
});

export async function GET(request) {
    const { response } = await requirePermission("employees.view");
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const today = getSchoolDateParts();
    const todayDate = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
    const defaultFromDate = `${today.year}-${String(today.month).padStart(2, "0")}-01`;
    const fromDate = isValidDate(searchParams.get("from")) ? searchParams.get("from") : defaultFromDate;
    const throughDate = isValidDate(searchParams.get("to")) ? searchParams.get("to") : todayDate;
    if (fromDate > throughDate) return NextResponse.json({ message: "From date must be on or before To date." }, { status: 400 });
    const startTime = Date.parse(`${fromDate}T00:00:00Z`);
    const endTime = Date.parse(`${throughDate}T00:00:00Z`);
    const daysToShow = Math.floor((endTime - startTime) / 86_400_000) + 1;
    const year = Number(fromDate.slice(0, 4));
    const month = Number(fromDate.slice(5, 7));
    const lastDay = new Date(year, month, 0).getDate();
    const includesToday = fromDate <= todayDate && throughDate >= todayDate;
    const toDate = `${throughDate} 23:59:59`;

    try {
        const supabase = getSupabaseAdmin();
        const machineConfig = getStudentEsslConfig();
        const { data: records, error: studentError } = await supabase.from("students").select("*").order("name", { ascending: true });
        if (studentError) return studentTableError(studentError);

        let machine = { logs: [], error: null };
        try {
            const response = await fetch(machineConfig.endpoint, {
                method: "POST",
                headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://tempuri.org/GetTransactionsLog" },
                body: buildSoapRequest(fromDate, toDate, machineConfig),
                cache: "no-store",
                signal: AbortSignal.timeout(12_000)
            });
            if (!response.ok) throw new Error(`eSSL server returned HTTP ${response.status}`);
            const xml = await response.text();
            const fault = xml.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
            if (fault) throw new Error(`eSSL rejected the attendance request: ${decodeEsslXml(fault[1])}`);
            const dataList = xml.match(/<(?:\w+:)?strDataList[^>]*>([\s\S]*?)<\/(?:\w+:)?strDataList>/i);
            machine.logs = parseLogs(dataList ? decodeEsslXml(dataList[1]) : "");
        } catch (error) {
            machine.error = error.message || "Could not connect to the student biometric machine.";
        }

        let todayLogs = includesToday ? machine.logs.filter((log) => log.timestamp.startsWith(todayDate)) : [];
        let todayMachineError = null;
        if (!includesToday || machine.error) {
            try {
                const todayResponse = await fetch(machineConfig.endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://tempuri.org/GetTransactionsLog" },
                    body: buildSoapRequest(todayDate, `${todayDate} 23:59:59`, machineConfig),
                    cache: "no-store",
                    signal: AbortSignal.timeout(12_000)
                });
                if (!todayResponse.ok) throw new Error(`eSSL server returned HTTP ${todayResponse.status}`);
                const todayXml = await todayResponse.text();
                const todayFault = todayXml.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
                if (todayFault) throw new Error(`eSSL rejected today's attendance request: ${decodeEsslXml(todayFault[1])}`);
                const todayDataList = todayXml.match(/<(?:\w+:)?strDataList[^>]*>([\s\S]*?)<\/(?:\w+:)?strDataList>/i);
                todayLogs = parseLogs(todayDataList ? decodeEsslXml(todayDataList[1]) : "").filter((log) => log.timestamp.startsWith(todayDate));
            } catch (error) {
                todayMachineError = error.message || "Could not load today's biometric punches.";
            }
        }

        const students = (records || []).map((record) => {
            const biometricId = String(record.biometric_id || "").trim();
            const punchesByDate = new Map();
            for (const log of machine.logs) {
                if (log.esslId !== biometricId) continue;
                const date = log.timestamp.slice(0, 10);
                if (!punchesByDate.has(date)) punchesByDate.set(date, []);
                punchesByDate.get(date).push(log.timestamp.slice(11, 19));
            }
            const attendance = Array.from({ length: daysToShow }, (_, index) => {
                const date = new Date(startTime + index * 86_400_000).toISOString().slice(0, 10);
                const punches = (punchesByDate.get(date) || []).sort();
                return { date, day: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }), punches, status: punches.length ? "Present" : "Absent" };
            });
            const presentDays = attendance.filter((day) => day.punches.length > 0).length;
            const todayPunches = todayLogs.filter((log) => log.esslId === biometricId).map((log) => log.timestamp.slice(11, 19)).sort();
            return {
                id: record.id,
                studentCode: String(record.student_code || ""),
                name: String(record.name || ""),
                className: String(record.class_name || "Class not set"),
                section: String(record.section || ""),
                guardianName: String(record.guardian_name || ""),
                phone: String(record.phone || ""),
                esslId: biometricId,
                presentDays,
                absentDays: attendance.length - presentDays,
                hasBiometricMatch: Boolean(biometricId && machine.logs.some((log) => log.esslId === biometricId)),
                todayPunches,
                attendance
            };
        }).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
        const classes = [...new Set(students.map((student) => student.className).filter((name) => name !== "Class not set"))]
            .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));
        const studentIds = new Set(students.map((student) => student.esslId).filter(Boolean));
        return NextResponse.json({
                students, classes, machineSerial: machineConfig.serialNumber, month, year, fromDate, toDate: throughDate,
            daysInMonth: lastDay, daysShown: daysToShow, asOfDate: toDate.slice(0, 10),
            todayDate, todayMachineError,
            logsReceived: machine.logs.length,
            matchedStudentPunches: machine.logs.filter((log) => studentIds.has(log.esslId)).length,
            matchedStudentUsers: new Set(machine.logs.map((log) => log.esslId).filter((id) => studentIds.has(id))).size,
            unmatchedMachineIds: [...new Set(machine.logs.map((log) => log.esslId).filter((id) => !studentIds.has(id)))],
            machineError: machine.error,
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Student attendance fetch failed:", error);
        return NextResponse.json({ message: "Student attendance could not be loaded.", error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const { response } = await requirePermission("employees.create");
    if (response) return response;
    const parsed = studentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Please enter a name, class and biometric ID.", errors: parsed.error.flatten() }, { status: 400 });

    const data = parsed.data;
    const supabase = getSupabaseAdmin();
    const { data: student, error } = await supabase.from("students").upsert({
        name: data.name,
        student_code: data.studentCode || data.biometricId,
        class_name: data.className,
        section: data.section || null,
        guardian_name: data.guardianName || null,
        phone: data.phone || null,
        biometric_id: data.biometricId
    }, { onConflict: "biometric_id" }).select("*").single();
    if (error) return studentTableError(error);
    return NextResponse.json({ student: studentRecord(student) }, { status: 201 });
}

export async function PATCH(request) {
    const { response } = await requirePermission("employees.edit");
    if (response) return response;
    const body = await request.json().catch(() => null);
    const id = String(body?.id || "");
    const parsed = studentSchema.safeParse(body?.student);
    if (!id || !parsed.success) return NextResponse.json({ message: "Student details are invalid." }, { status: 400 });
    const data = parsed.data;
    const { data: student, error } = await getSupabaseAdmin().from("students").update({
        name: data.name, student_code: data.studentCode || null, class_name: data.className,
        section: data.section || null, guardian_name: data.guardianName || null,
        phone: data.phone || null, biometric_id: data.biometricId
    }).eq("id", id).select("*").single();
    if (error) return studentTableError(error);
    return NextResponse.json({ student: studentRecord(student) });
}

function studentRecord(record) {
    return { id: String(record.id), name: record.name || "", studentCode: record.student_code || "", className: record.class_name || "", section: record.section || "", guardianName: record.guardian_name || "", phone: record.phone || "", esslId: record.biometric_id || "" };
}

function studentTableError(error) {
    const missingTable = error.code === "42P01" || /relation .*students.* does not exist/i.test(error.message || "");
    return NextResponse.json({
        message: missingTable ? "Student records table is not set up yet. Run database/create_students_table.sql in Supabase SQL Editor, then reload." : "Could not read or save student records.",
        error: error.message,
        code: error.code
    }, { status: missingTable ? 503 : 500 });
}

function getSchoolDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function buildSoapRequest(fromDate, toDate, config) {
    return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetTransactionsLog xmlns="http://tempuri.org/"><FromDateTime>${fromDate}</FromDateTime><ToDateTime>${toDate}</ToDateTime><SerialNumber>${escapeEsslXml(config.serialNumber)}</SerialNumber><UserName>${escapeEsslXml(config.username)}</UserName><UserPassword>${escapeEsslXml(config.password)}</UserPassword><strDataList></strDataList></GetTransactionsLog></soap:Body></soap:Envelope>`;
}

function parseLogs(raw) {
    return String(raw || "").split(/\r?\n/).map((line) => line.trim().split("\t"))
        .filter((parts) => parts.length >= 2 && parts[0].trim() && parts[1].trim())
        .map((parts) => ({ esslId: parts[0].trim(), timestamp: parts[1].trim() }));
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
