import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_BRANCH_1 = {
    name: "Branch 1",
    endpoint: process.env.ESSL_API_URL_BRANCH_1 || process.env.ESSL_API_URL || "https://isopentyl-immersed-cecelia.ngrok-free.dev/iclock/WebAPIService.asmx",
    serialNumber: process.env.ESSL_SERIAL_NUMBER_BRANCH_1 || process.env.ESSL_SERIAL_NUMBER || "NfZ8243803928",
    username: process.env.ESSL_API_USERNAME_BRANCH_1 || process.env.ESSL_API_USERNAME || "api",
    password: process.env.ESSL_API_PASSWORD_BRANCH_1 || process.env.ESSL_API_PASSWORD || "Akash@8299"
};

const DEFAULT_BRANCH_2 = {
    name: "Branch 2",
    endpoint: process.env.ESSL_API_URL_BRANCH_2 || "",
    serialNumber: process.env.ESSL_SERIAL_NUMBER_BRANCH_2 || "",
    username: process.env.ESSL_API_USERNAME_BRANCH_2 || "api",
    password: process.env.ESSL_API_PASSWORD_BRANCH_2 || ""
};

async function fetchBranchLogs(config, fromDate, toDate) {
    if (!config?.endpoint || !config.endpoint.startsWith("http")) {
        return [];
    }

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>${fromDate}</FromDateTime>
      <ToDateTime>${toDate}</ToDateTime>
      <SerialNumber>${escapeXml(config.serialNumber || "")}</SerialNumber>
      <UserName>${escapeXml(config.username || "api")}</UserName>
      <UserPassword>${escapeXml(config.password || "")}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

    try {
        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction": "http://tempuri.org/GetTransactionsLog"
            },
            body: soapRequest,
            cache: "no-store",
            signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
            console.error(`eSSL request failed for ${config.name}: HTTP ${response.status}`);
            return [];
        }

        const xmlText = await response.text();
        const faultMatch = xmlText.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
        if (faultMatch) {
            console.error(`eSSL SOAP Fault for ${config.name}:`, decodeXml(faultMatch[1].trim()));
            return [];
        }

        const dataListMatch = xmlText.match(/<(?:\w+:)?strDataList[^>]*>([\s\S]*?)<\/(?:\w+:)?strDataList>/i);
        const rawData = dataListMatch ? decodeXml(dataListMatch[1]).trim() : "";
        const logs = [];

        if (rawData) {
            const lines = rawData.split(/\r?\n/);
            for (const line of lines) {
                const parts = line.trim().split("\t");
                if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
                    logs.push({
                        esslId: parts[0].trim(),
                        timestamp: parts[1].trim(),
                        branch: config.name || "Branch 1"
                    });
                }
            }
        }
        return logs;
    } catch (err) {
        console.error(`Fetch error for ${config.name}:`, err.message);
        return [];
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const branchParam = searchParams.get("branch") || "All";
    const holidaysProvided = searchParams.has("holidays");
    let holidaysParam = searchParams.get("holidays") || "";
    let holidayDates = parseHolidayDates(holidaysParam);

    const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")} 23:59:59`;
    
    const branchKeyPart = branchParam !== "All" ? `_${branchParam.replace(/\s+/g, "_")}` : "";
    const snapshotKey = `essl_attendance_${year}_${String(month).padStart(2, "0")}${branchKeyPart}`;

    let supabase;
    let cachedSnapshot = null;

    try {
        supabase = getSupabaseAdmin();
        const { data: cached } = await supabase.from("settings").select("value").eq("key", snapshotKey).maybeSingle();
        cachedSnapshot = cached?.value || null;

        if (!holidaysProvided) {
            const holidayKey = `holidays_${year}_${month}`;
            const { data: savedHolidays } = await supabase.from("settings").select("value").eq("key", holidayKey).maybeSingle();
            holidaysParam = savedHolidays?.value?.dates ?? (cachedSnapshot?.holidays || []).join(",");
            holidayDates = parseHolidayDates(holidaysParam);
        }

        // Fetch Branch Configurations from settings
        const { data: settingsRows } = await supabase
            .from("settings")
            .select("key, value")
            .in("key", ["essl_config_branch_1", "essl_config_branch_2"]);

        const settingsMap = {};
        (settingsRows || []).forEach(row => {
            settingsMap[row.key] = row.value;
        });

        const branch1Config = { ...DEFAULT_BRANCH_1, ...(settingsMap.essl_config_branch_1 || {}), name: "Branch 1" };
        const branch2Config = { ...DEFAULT_BRANCH_2, ...(settingsMap.essl_config_branch_2 || {}), name: "Branch 2" };

        // Determine which machines to poll based on branch selection
        const fetchPromises = [];
        if (branchParam === "Branch 1" || branchParam === "All") {
            fetchPromises.push(fetchBranchLogs(branch1Config, fromDate, toDate));
        }
        if (branchParam === "Branch 2" || branchParam === "All") {
            fetchPromises.push(fetchBranchLogs(branch2Config, fromDate, toDate));
        }

        const logResults = await Promise.all(fetchPromises);
        const logs = logResults.flat();

        // Fetch active employees
        let employeeQuery = supabase.from("employees").select("*").eq("status", "Active");
        if (branchParam !== "All") {
            employeeQuery = employeeQuery.eq("branch", branchParam);
        }
        const { data: employees, error: employeesError } = await employeeQuery;
        if (employeesError) throw employeesError;

        // Generate month dates
        const monthDates = [];
        for (let i = 1; i <= lastDay; i++) {
            const d = new Date(year, month - 1, i);
            monthDates.push({
                date: `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
                isSunday: d.getDay() === 0,
                isHoliday: holidayDates.includes(i),
                dayName: d.toLocaleDateString("en-US", { weekday: "short" })
            });
        }
        const totalWorkingDays = monthDates.filter(d => !d.isSunday && !d.isHoliday).length;

        // Map attendance per employee
        const report = [];

        for (const emp of employees || []) {
            const esslId = emp.bank_details?.esslMachineId || emp.bank_details?.essl_machine_id;
            if (!esslId) continue;

            const dept = String(emp.department || "General").trim();
            const empBranch = String(emp.branch || "Branch 1").trim();
            const role = String(emp.role || "Staff").trim();

            // Builder duty rules: Standard 8h duty
            const requiredHours = 8;
            const halfDayThreshold = 4.5;

            // Match logs by esslId
            const empLogs = logs.filter(l => l.esslId === esslId);
            const attendanceRecord = [];
            let daysPresent = 0;
            let fullDaysCount = 0;
            let halfDaysCount = 0;
            let absentDaysCount = 0;

            for (const day of monthDates) {
                const dayLogs = empLogs.filter(l => l.timestamp.startsWith(day.date));
                const sortedTimestamps = dayLogs.map(l => l.timestamp.trim()).sort();
                const punches = sortedTimestamps.map(t => t.split(" ")[1] || t);

                let workedMinutes = 0;
                let workedHours = 0;
                let workedDurationText = "-";

                if (punches.length >= 2) {
                    const firstTime = new Date(sortedTimestamps[0].replace(" ", "T"));
                    const lastTime = new Date(sortedTimestamps[sortedTimestamps.length - 1].replace(" ", "T"));
                    const diffMs = lastTime.getTime() - firstTime.getTime();
                    workedMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    workedHours = Number((workedMinutes / 60).toFixed(2));
                    const hrs = Math.floor(workedMinutes / 60);
                    const mins = workedMinutes % 60;
                    workedDurationText = `${hrs}h ${mins}m`;
                } else if (punches.length === 1) {
                    workedDurationText = "Single punch";
                    workedMinutes = 0;
                    workedHours = 0;
                }

                let status = "Absent";
                let presentValue = 0;

                if (day.isSunday) {
                    status = "Sunday";
                } else if (day.isHoliday) {
                    status = "Holiday";
                } else {
                    if (punches.length === 0) {
                        status = "Absent";
                        absentDaysCount++;
                    } else {
                        status = "Present";
                        presentValue = 1.0;
                        fullDaysCount++;
                    }
                    daysPresent += presentValue;
                }

                attendanceRecord.push({
                    ...day,
                    punches,
                    workedHours,
                    workedMinutes,
                    workedDurationText,
                    presentValue,
                    status
                });
            }

            const formattedDaysPresent = Number(daysPresent.toFixed(1));
            const percentage = totalWorkingDays > 0 ? Math.round((formattedDaysPresent / totalWorkingDays) * 100) : 0;

            report.push({
                employeeId: emp.employee_id,
                name: emp.name,
                role,
                department: dept,
                branch: empBranch,
                category: role,
                requiredHours,
                halfDayThreshold,
                esslId,
                totalWorkingDays,
                daysPresent: formattedDaysPresent,
                fullDaysCount,
                halfDaysCount,
                absentDaysCount,
                percentage,
                attendanceRecord
            });
        }

        // Cache snapshot if logs received
        if (logs.length === 0 && Number(cachedSnapshot?.diagnostics?.logsReceived) > 0 && Array.isArray(cachedSnapshot?.report)) {
            return NextResponse.json({
                report: applyHolidayDates(cachedSnapshot.report, year, month, holidayDates),
                success: true,
                stale: true,
                snapshotSaved: true,
                lastSyncedAt: cachedSnapshot.syncedAt || null,
                latestPunch: cachedSnapshot.diagnostics?.latestPunch || null,
                diagnostics: { ...cachedSnapshot.diagnostics, fromDate, toDate, branch: branchParam },
                message: "The machines returned no punches; showing the last saved attendance snapshot."
            });
        }

        const syncedAt = new Date().toISOString();
        const diagnostics = {
            logsReceived: logs.length,
            latestPunch: logs.reduce((latest, log) => (log.timestamp > (latest || "") ? log.timestamp : latest), null),
            fromDate,
            toDate,
            branch: branchParam
        };

        const { error: snapshotSaveError } = await supabase.from("settings").upsert({
            key: snapshotKey,
            value: { report, diagnostics, holidays: holidayDates, syncedAt }
        }, { onConflict: "key" });

        return NextResponse.json({
            report,
            success: true,
            diagnostics,
            lastSyncedAt: syncedAt,
            latestPunch: diagnostics.latestPunch,
            stale: false,
            snapshotSaved: !snapshotSaveError
        });
    } catch (error) {
        console.error("eSSL Report API Error:", error);
        if (Array.isArray(cachedSnapshot?.report)) {
            const report = applyHolidayDates(cachedSnapshot.report, year, month, holidayDates);
            return NextResponse.json({
                report,
                success: true,
                stale: true,
                snapshotSaved: true,
                lastSyncedAt: cachedSnapshot.syncedAt || null,
                latestPunch: cachedSnapshot.diagnostics?.latestPunch || null,
                diagnostics: { ...cachedSnapshot.diagnostics, fromDate, toDate, branch: branchParam },
                message: "eSSL server unavailable; showing last saved attendance snapshot."
            });
        }
        return NextResponse.json({ message: "Internal Error", error: String(error) }, { status: 500 });
    }
}

function applyHolidayDates(report, year, month, holidayDates) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const holidaySet = new Set(holidayDates);
    const totalWorkingDays = Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(year, month - 1, index + 1);
        return date.getDay() !== 0 && !holidaySet.has(index + 1);
    }).filter(Boolean).length;

    return report.map((employee) => {
        let daysPresent = 0;
        let fullDaysCount = 0;
        let halfDaysCount = 0;
        let absentDaysCount = 0;

        const attendanceRecord = (employee.attendanceRecord || []).map((day) => {
            const dayNumber = Number(String(day.date).slice(-2));
            const isHoliday = holidaySet.has(dayNumber) && !day.isSunday;
            let status = "Absent";
            let presentValue = 0;
            if (day.isSunday) status = "Sunday";
            else if (isHoliday) status = "Holiday";
            else if ((day.punches || []).length === 0) absentDaysCount += 1;
            else {
                status = "Present";
                presentValue = 1;
                fullDaysCount++;
                daysPresent += presentValue;
            }
            return { ...day, isHoliday, status, presentValue };
        });

        return {
            ...employee,
            requiredHours: 8,
            halfDayThreshold: 4.5,
            totalWorkingDays,
            daysPresent: Number(daysPresent.toFixed(1)),
            fullDaysCount,
            halfDaysCount,
            absentDaysCount,
            percentage: totalWorkingDays > 0 ? Math.round((daysPresent / totalWorkingDays) * 100) : 0,
            attendanceRecord
        };
    });
}

function parseHolidayDates(value) {
    return String(value || "")
        .split(",")
        .map((day) => parseInt(day.trim(), 10))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
}

function escapeXml(value) {
    return String(value).replace(/[<>&'"]/g, (character) => ({
        "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
    })[character]);
}

function decodeXml(value) {
    return String(value)
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&amp;/gi, "&");
}
