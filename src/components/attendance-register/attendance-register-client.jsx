"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CalendarDays, CheckCircle2, CircleAlert, Clock3, Download, Printer, RefreshCw, Search, Users, Save } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { openAttendanceRegister } from "./print-register";
import * as XLSX from "xlsx";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const todayInSchool = () => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return values.year + "-" + values.month + "-" + values.day;
};

function getSessionStart(today) {
    const parts = today.split("-").map(Number);
    const sessionYear = parts[1] >= 4 ? parts[0] : parts[0] - 1;
    return String(sessionYear) + "-04-01";
}

function dateRange(fromDate, toDate) {
    const start = Date.parse(fromDate + "T00:00:00Z");
    const end = Date.parse(toDate + "T00:00:00Z");
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return Array.from({ length: Math.floor((end - start) / 86400000) + 1 }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10));
}

function monthBounds(date) {
    const parts = date.slice(0, 7).split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const prefix = String(year) + "-" + String(month).padStart(2, "0");
    const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: prefix + "-01", end: prefix + "-" + String(endDay).padStart(2, "0") };
}

function previousMonthBounds(date) {
    const parts = date.slice(0, 7).split("-").map(Number);
    const prior = new Date(Date.UTC(parts[0], parts[1] - 2, 1));
    const year = prior.getUTCFullYear();
    const month = prior.getUTCMonth() + 1;
    const prefix = String(year) + "-" + String(month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: prefix + "-01", end: prefix + "-" + String(lastDay).padStart(2, "0") };
}

function formatShortDate(date) {
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

function formatTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return "—";
    const hour = Number(match[1]);
    return String(hour % 12 || 12) + ":" + match[2] + " " + (hour >= 12 ? "PM" : "AM");
}

function getMonthKeys(fromDate, toDate) {
    if (!fromDate || !toDate || fromDate > toDate) return [];
    const start = fromDate.slice(0, 7).split("-").map(Number);
    const end = toDate.slice(0, 7).split("-").map(Number);
    const keys = [];
    let year = start[0];
    let month = start[1];
    while (year < end[0] || (year === end[0] && month <= end[1])) {
        keys.push({ year, month });
        if (month === 12) { year += 1; month = 1; } else month += 1;
        if (keys.length > 120) break;
    }
    return keys;
}

function parseHolidayDates(monthRecords) {
    const dates = new Set();
    for (const record of monthRecords) {
        const year = record.year;
        const month = record.month;
        for (const raw of String(record.value || "").split(/[\s,;]+/)) {
            const day = Number(raw.trim());
            const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
            if (Number.isInteger(day) && day >= 1 && day <= lastDay) {
                dates.add(String(year) + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"));
            }
        }
    }
    return dates;
}

function isWorkingSchoolDay(date, holidays) {
    return new Date(date + "T12:00:00Z").getUTCDay() !== 0 && !holidays.has(date);
}

function countWorkingDays(fromDate, toDate, holidays) {
    return dateRange(fromDate, toDate).filter((date) => isWorkingSchoolDay(date, holidays)).length;
}

function countPresentDays(student, fromDate, toDate) {
    const attendance = new Map((student.attendance || []).map((day) => [day.date, day]));
    return dateRange(fromDate, toDate).filter((date) => (attendance.get(date)?.punches || []).length > 0).length;
}

function getMonthTitle(date) {
    return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date.slice(0, 7) + "-15T12:00:00Z"));
}

function parseHolidayDays(value, year, month) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const parts = String(value || "").split(/[,;\s]+/).filter(Boolean);
    const invalid = parts.filter((part) => !/^\d{1,2}$/.test(part) || Number(part) < 1 || Number(part) > lastDay);
    const days = [...new Set(parts.filter((part) => /^\d{1,2}$/.test(part) && Number(part) >= 1 && Number(part) <= lastDay).map(Number))].sort((a, b) => a - b);
    return { days, invalid };
}

function downloadAttendanceExcel({ students, dates, holidays, dateFrom, dateTo, className, section, attendanceFilter, summary }) {
    const workbook = XLSX.utils.book_new();
    const filterText = attendanceFilter === "all" ? "All students" : attendanceFilter === "present" ? "Present in range" : "Absent in range";
    const titleRows = (heading, rangeLabel) => [
        ["KM Builders"],
        [heading],
        ["EMPLOYEE ATTENDANCE REGISTER · P = PRESENT · A = ABSENT · blank = SUNDAY / SAVED HOLIDAY"],
        ["REPORT RANGE: " + dateFrom + " to " + dateTo + " · " + rangeLabel],
        ["CLASS: " + (className === "All" ? "All classes" : className) + " · SECTION: " + (section === "All" ? "All sections" : section) + " · FILTER: " + filterText],
        ["Names alphabetical · First biometric punch determines presence · No times or seconds in this P/A register"],
        []
    ];
    const commonHeaders = ["S. No.", "ID Number", "Student Name", "Class & Section", "Range P/A"];
    const summaryHeaders = [...commonHeaders, "Selected Present", "Present · This Month", "Present · Last Month", "Session Present / Working"];
    const summaryRows = students.map((student, index) => [index + 1, student.studentCode || student.esslId || "—", String(student.name || "").toLocaleUpperCase("en"), (student.className || "—") + (student.section ? "-" + student.section : ""), student.selectedPresent > 0 ? "P" : "A", student.selectedPresent, student.currentMonthPresent, student.previousMonthPresent, student.sessionPresent + " / " + summary.sessionWorkingDays]);
    const addSheet = (name, heading, rangeLabel, headers, rows, widths, dayStartColumn = -1) => {
        const sheet = XLSX.utils.aoa_to_sheet([...titleRows(heading, rangeLabel), headers, ...rows]);
        const lastColumn = headers.length - 1;
        sheet["!merges"] = titleRows(heading, rangeLabel).slice(0, 6).map((_, row) => ({ s: { r: row, c: 0 }, e: { r: row, c: lastColumn } }));
        sheet["!cols"] = widths.map((wch) => ({ wch }));
        sheet["!rows"] = [...titleRows(heading, rangeLabel).map(() => ({ hpt: 20 })), { hpt: 28 }, ...rows.map(() => ({ hpt: 21 }))];
        sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 7, c: 0 }, e: { r: rows.length + 7, c: lastColumn } }) };
        sheet["!freeze"] = { xSplit: 4, ySplit: 8, topLeftCell: "E9", activePane: "bottomRight", state: "frozen" };
        sheet["!pageSetup"] = { paperSize: 5, orientation: "landscape", fitToWidth: 1, fitToHeight: 0, scale: 0 };
        sheet["!printOptions"] = { horizontalCentered: true };
        sheet["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
        sheet["!printArea"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 7, c: lastColumn } });
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
        return { dayStartColumn, rows };
    };
    const sheetStyles = [addSheet("Register Summary", "ATTENDANCE SUMMARY", "Full selected range · summary counts", summaryHeaders, summaryRows, [7, 13, 29, 17, 12, 15, 16, 16, 21])];
    const chunks = Array.from({ length: Math.ceil(dates.length / 10) }, (_, index) => dates.slice(index * 10, (index + 1) * 10));
    chunks.forEach((chunk, index) => {
        const rangeLabel = chunk[0].slice(8, 10) + "-" + chunk[0].slice(5, 7) + "-" + chunk[0].slice(2, 4) + " to " + chunk[chunk.length - 1].slice(8, 10) + "-" + chunk[chunk.length - 1].slice(5, 7) + "-" + chunk[chunk.length - 1].slice(2, 4);
        const rows = students.map((student, studentIndex) => {
            const attendance = new Map((student.attendance || []).map((day) => [day.date, day]));
            return [studentIndex + 1, student.studentCode || student.esslId || "—", String(student.name || "").toLocaleUpperCase("en"), (student.className || "—") + (student.section ? "-" + student.section : ""), student.selectedPresent > 0 ? "P" : "A", ...chunk.map((date) => {
                if (!isWorkingSchoolDay(date, holidays)) return "";
                return (attendance.get(date)?.punches || []).length ? "P" : "A";
            })];
        });
        const name = "Daily " + String(index + 1).padStart(2, "0");
        sheetStyles.push(addSheet(name, "DAILY P / A REGISTER · SHEET " + (index + 1) + " OF " + chunks.length, rangeLabel + " · Working days: " + summary.selectedRangeWorkingDays, [...commonHeaders, ...chunk.map((date) => date.slice(8, 10) + "-" + date.slice(5, 7) + "-" + date.slice(2, 4))], rows, [7, 13, 30, 18, 12, ...chunk.map(() => 11)], 5));
    });

    const rawWorkbook = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
    const archive = unzipSync(new Uint8Array(rawWorkbook));
    const fontNodes = [
        '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font>',
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>',
        '<font><sz val="9"/><color rgb="FF24364B"/><name val="Aptos"/></font>',
        '<font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>',
        '<font><sz val="9"/><color rgb="FF000000"/><name val="Aptos"/></font>',
        '<font><b/><sz val="9"/><color rgb="FF08795C"/><name val="Aptos"/></font>',
        '<font><b/><sz val="9"/><color rgb="FFBE3245"/><name val="Aptos"/></font>'
    ];
    const fillNodes = ["FF173B73", "FFE8EFF8", "FFFFFFFF", "FFE8F6EF", "FFFDECEF"].map((color) => '<fill><patternFill patternType="solid"><fgColor rgb="' + color + '"/><bgColor indexed="64"/></patternFill></fill>');
    const borderNode = '<border><left style="thin"><color rgb="FFB8C8DA"/></left><right style="thin"><color rgb="FFB8C8DA"/></right><top style="thin"><color rgb="FFB8C8DA"/></top><bottom style="thin"><color rgb="FFB8C8DA"/></bottom><diagonal/></border>';
    const xfNodes = [
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
        '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
        '<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
        '<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
        '<xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="7" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        '<xf numFmtId="0" fontId="7" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
    ];
    let stylesXml = strFromU8(archive["xl/styles.xml"]);
    stylesXml = stylesXml.replace(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/, (_, count, content) => '<fonts count="' + (Number(count) + fontNodes.length) + '">' + content + fontNodes.join("") + "</fonts>");
    stylesXml = stylesXml.replace(/<fills count="(\d+)">([\s\S]*?)<\/fills>/, (_, count, content) => '<fills count="' + (Number(count) + fillNodes.length) + '">' + content + fillNodes.join("") + "</fills>");
    stylesXml = stylesXml.replace(/<borders count="(\d+)">([\s\S]*?)<\/borders>/, (_, count, content) => '<borders count="' + (Number(count) + 1) + '">' + content + borderNode + "</borders>");
    stylesXml = stylesXml.replace(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/, (_, count, content) => '<cellXfs count="' + (Number(count) + xfNodes.length) + '">' + content + xfNodes.join("") + "</cellXfs>");
    archive["xl/styles.xml"] = strToU8(stylesXml);
    const cellReferenceToColumn = (reference) => [...reference.match(/[A-Z]+/)[0]].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;
    workbook.SheetNames.forEach((_, index) => {
        const path = "xl/worksheets/sheet" + (index + 1) + ".xml";
        let sheetXml = strFromU8(archive[path]);
        sheetXml = sheetXml.replace('<sheetView workbookViewId="0"/>', '<sheetView workbookViewId="0" showGridLines="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A9" sqref="A9"/></sheetView>');
        sheetXml = sheetXml.replace("<dimension", '<sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><dimension');
        sheetXml = sheetXml.replace("<ignoredErrors", '<pageSetup paperSize="5" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C&amp;"Aptos,Bold"&amp;9 KM Builders · Attendance Register &amp;RPage &amp;P of &amp;N</oddFooter></headerFooter><ignoredErrors');
        const bodyRows = sheetStyles[index].rows;
        const dayStartColumn = sheetStyles[index].dayStartColumn;
        sheetXml = sheetXml.replace(/<c r="([A-Z]+)(\d+)"([^>]*)>/g, (tag, column, row) => {
            const rowNumber = Number(row);
            const columnNumber = cellReferenceToColumn(column);
            let style = null;
            if (rowNumber === 1) style = 1;
            else if (rowNumber === 2) style = 2;
            else if (rowNumber >= 3 && rowNumber <= 6) style = 3;
            else if (rowNumber === 8) style = 4;
            else if (rowNumber >= 9) {
                style = (rowNumber - 9) % 2 === 0 ? 5 : 6;
                const value = bodyRows[rowNumber - 9]?.[columnNumber];
                if (columnNumber === 4 && value === "P") style = 7;
                else if (columnNumber === 4 && value === "A") style = 8;
                else if (dayStartColumn >= 0 && columnNumber >= dayStartColumn && value === "P") style = 9;
                else if (dayStartColumn >= 0 && columnNumber >= dayStartColumn && value === "A") style = 10;
            }
            return style === null ? tag : tag.slice(0, -1) + ' s="' + style + '">';
        });
        archive[path] = strToU8(sheetXml);
    });
    const styledWorkbook = zipSync(archive, { level: 6 });
    const file = new Blob([styledWorkbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const downloadUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "School_Attendance_Register_" + dateFrom + "_to_" + dateTo + ".xlsx";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export function AttendanceRegisterClient() {
    const { notify } = useToast();
    const today = todayInSchool();
    const [dateFrom, setDateFrom] = useState(monthBounds(today).start);
    const [dateTo, setDateTo] = useState(today);
    const [sessionStartDate, setSessionStartDate] = useState(getSessionStart(today));
    const [attendanceFilter, setAttendanceFilter] = useState("all");
    const [classFilter, setClassFilter] = useState("All");
    const [sectionFilter, setSectionFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [holidayMonth, setHolidayMonth] = useState(monthBounds(today).start.slice(0, 7));
    const [holidayDays, setHolidayDays] = useState("");
    const [holidaySaving, setHolidaySaving] = useState(false);
    const [holidayMessage, setHolidayMessage] = useState("");

    useEffect(() => {
        if (!holidayMonth) return;
        const [year, month] = holidayMonth.split("-").map(Number);
        fetch("/api/essl/holidays?month=" + month + "&year=" + year, { cache: "no-store" })
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Holiday dates could not be loaded.");
                setHolidayDays(result.holidays || "");
                setHolidayMessage("");
            })
            .catch((loadError) => setHolidayMessage(loadError.message));
    }, [holidayMonth]);

    async function saveHolidayCalendar() {
        const [year, month] = holidayMonth.split("-").map(Number);
        const { days, invalid } = parseHolidayDays(holidayDays, year, month);
        if (invalid.length) {
            setHolidayMessage("Invalid day number(s): " + invalid.join(", ") + ". Enter 1 to " + new Date(Date.UTC(year, month, 0)).getUTCDate() + ".");
            return;
        }
        setHolidaySaving(true);
        setHolidayMessage("");
        try {
            const response = await fetch("/api/essl/holidays?month=" + month + "&year=" + year, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, year, holidays: days.join(",") }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Holiday calendar could not be saved.");
            setHolidayMessage("Saved to the school server · " + (days.length ? days.join(", ") : "no holidays") + " for " + new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15))));
            notify({ tone: "success", title: "Holiday calendar saved", description: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15))) });
            await loadRegister();
        } catch (saveError) {
            setHolidayMessage(saveError.message || "Holiday calendar could not be saved.");
            notify({ tone: "error", title: saveError.message || "Holiday calendar could not be saved" });
        } finally {
            setHolidaySaving(false);
        }
    }

    async function loadRegister() {
        if (!dateFrom || !dateTo || dateFrom > dateTo) {
            setError("Choose a valid date range. From date must be on or before To date.");
            return;
        }
        if (dateTo > today) {
            setError("To date cannot be later than today.");
            return;
        }
        if (!sessionStartDate || sessionStartDate > dateTo) {
            setError("Session start must be on or before the To date.");
            return;
        }
        const requiredHistoryStart = [dateFrom, sessionStartDate, monthBounds(dateTo).start, previousMonthBounds(dateTo).start].sort()[0];
        const dataFrom = requiredHistoryStart;
        setLoading(true);
        setError("");
        setData(null);
        try {
            const response = await fetch("/api/student-attendance?from=" + dataFrom + "&to=" + dateTo, { cache: "no-store" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Attendance register could not be loaded.");
            const monthKeys = getMonthKeys(dataFrom, dateTo);
            const holidayResults = await Promise.allSettled(monthKeys.map(async ({ year, month }) => {
                const holidayResponse = await fetch("/api/essl/holidays?month=" + month + "&year=" + year, { cache: "no-store" });
                if (!holidayResponse.ok) throw new Error("Holiday calendar unavailable.");
                const holidayData = await holidayResponse.json();
                return { year, month, value: holidayData.holidays || "" };
            }));
            const holidayRecords = holidayResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
            const holidayLoadErrors = holidayResults.filter((result) => result.status === "rejected").length;
            setData({ ...result, holidays: parseHolidayDates(holidayRecords), holidayLoadErrors });
        } catch (loadError) {
            setError(loadError.message || "Attendance register could not be loaded.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadRegister(); }, []);

    const students = data?.students || [];
    const classOptions = data?.classes || [];
    const sectionOptions = useMemo(() => [...new Set(students.filter((student) => classFilter === "All" || student.className === classFilter).map((student) => student.section).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" })), [students, classFilter]);
    useEffect(() => {
        if (sectionFilter !== "All" && !sectionOptions.includes(sectionFilter)) setSectionFilter("All");
    }, [sectionFilter, sectionOptions]);

    const holidays = data?.holidays || new Set();
    const selectedRangeWorkingDays = countWorkingDays(dateFrom, dateTo, holidays);
    const currentMonth = monthBounds(dateTo);
    const currentMonthEnd = currentMonth.end < dateTo ? currentMonth.end : dateTo;
    const previousMonth = previousMonthBounds(dateTo);
    const sessionWorkingDays = countWorkingDays(sessionStartDate, dateTo, holidays);
    const currentMonthWorkingDays = countWorkingDays(currentMonth.start, currentMonthEnd, holidays);
    const previousMonthWorkingDays = countWorkingDays(previousMonth.start, previousMonth.end, holidays);
    const selectedDates = useMemo(() => dateRange(dateFrom, dateTo), [dateFrom, dateTo]);

    const filteredStudents = useMemo(() => students.map((student) => ({
        ...student,
        selectedPresent: countPresentDays(student, dateFrom, dateTo),
        currentMonthPresent: countPresentDays(student, currentMonth.start, currentMonthEnd),
        previousMonthPresent: countPresentDays(student, previousMonth.start, previousMonth.end),
        sessionPresent: countPresentDays(student, sessionStartDate, dateTo)
    })).filter((student) => {
        const matchesClass = classFilter === "All" || student.className === classFilter;
        const matchesSection = sectionFilter === "All" || student.section === sectionFilter;
        const query = search.trim().toLocaleLowerCase("en");
        const matchesSearch = !query || [student.name, student.studentCode, student.esslId, student.className, student.section].some((value) => String(value || "").toLocaleLowerCase("en").includes(query));
        const matchesStatus = attendanceFilter === "all" || (attendanceFilter === "present" ? student.selectedPresent > 0 : student.selectedPresent === 0);
        return matchesClass && matchesSection && matchesSearch && matchesStatus;
    }).sort((a, b) => String(a.name || "").trim().localeCompare(String(b.name || "").trim(), "en", { sensitivity: "base", numeric: true })), [students, dateFrom, dateTo, currentMonth.start, currentMonthEnd, previousMonth.start, previousMonth.end, sessionStartDate, classFilter, sectionFilter, search, attendanceFilter]);

    const isMachineUnavailable = Boolean(data?.machineError);
    const dateRangeValid = dateFrom && dateTo && dateFrom <= dateTo && dateTo <= today && sessionStartDate && sessionStartDate <= dateTo;

    function openPrintTab() {
        if (!data || isMachineUnavailable || !filteredStudents.length) return;
        openAttendanceRegister({
            students: filteredStudents,
            dates: selectedDates,
            dateFrom,
            dateTo,
            sessionStartDate,
            attendanceFilter,
            className: classFilter,
            section: sectionFilter,
            schoolName: "KM Builders",
            summary: {
                studentCount: filteredStudents.length,
                selectedRangeWorkingDays,
                currentMonthWorkingDays,
                previousMonthWorkingDays,
                sessionWorkingDays,
                currentMonthLabel: getMonthTitle(dateTo),
                previousMonthLabel: getMonthTitle(previousMonth.start),
                sessionLabel: formatShortDate(sessionStartDate) + " – " + formatShortDate(dateTo),
                holidayLoadErrors: data.holidayLoadErrors || 0
            },
            holidays
        });
    }

    return <div className="space-y-6">
        <PageHeading
            title="School Attendance Register"
            description="Month-wise biometric register with first punch only, student totals, and an A4 landscape print sheet."
            action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={loadRegister} disabled={loading || !dateRangeValid}><RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />Refresh</Button><Button variant="secondary" onClick={() => downloadAttendanceExcel({ students: filteredStudents, dates: selectedDates, holidays, dateFrom, dateTo, className: classFilter, section: sectionFilter, attendanceFilter, summary: { selectedRangeWorkingDays, sessionWorkingDays } })} disabled={loading || !data || isMachineUnavailable || !filteredStudents.length}><Download className="h-4 w-4" />Download Excel</Button><Button onClick={openPrintTab} disabled={loading || !data || isMachineUnavailable || !filteredStudents.length}><Printer className="h-4 w-4" />Open Print Register</Button></div>}
        />

        <Card className="border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/70 dark:border-indigo-900/50 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
            <CardHeader title="Register filters" description="Select a reporting range and school session. Attendance is read from the biometric machine; this report does not edit records." />
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="From date"><Input aria-label="From date" type="date" max={dateTo || today} value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setData(null); setError(""); }} /></Field>
                <Field label="To date"><Input aria-label="To date" type="date" max={today} min={dateFrom} value={dateTo} onChange={(event) => { setDateTo(event.target.value); setData(null); setError(""); }} /></Field>
                <Field label="School session starts"><Input aria-label="School session start date" type="date" max={dateTo || today} value={sessionStartDate} onChange={(event) => { setSessionStartDate(event.target.value); setData(null); setError(""); }} /></Field>
                <Field label="Class"><Select aria-label="Filter by class" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSectionFilter("All"); }}><option value="All">All classes</option>{classOptions.map((name) => <option key={name} value={name}>{name}</option>)}</Select></Field>
                <Field label="Section"><Select aria-label="Filter by section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}><option value="All">All sections</option>{sectionOptions.map((name) => <option key={name} value={name}>Section {name}</option>)}</Select></Field>
                <Field label="Student attendance"><Select aria-label="Filter by attendance status" value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)}><option value="all">All students</option><option value="present">Present in range</option><option value="absent">Absent in range</option></Select></Field>
                <Field label="Search by student / ID"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search student name or ID" className="pl-9" placeholder="Student name, roll ID or biometric ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div></Field>
                <div className="flex items-end"><Button className="w-full" onClick={loadRegister} disabled={loading || !dateRangeValid}><CalendarDays className="h-4 w-4" />{loading ? "Loading register…" : "Apply filters"}</Button></div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-indigo-100 px-5 py-3 text-xs text-slate-600 dark:border-indigo-900/40 dark:text-slate-300">
                <span>Working day rule: <b>Monday–Saturday</b>; Sundays and saved holidays are excluded.</span>
                <span>Selected dates: <b>{dateFrom} – {dateTo}</b></span>
                {data?.syncedAt ? <span>Machine data synced: <b>{new Date(data.syncedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</b></span> : null}
            </div>
        </Card>

        <Card className="border-amber-100 bg-gradient-to-br from-white to-amber-50/70 dark:border-amber-900/40 dark:from-slate-950 dark:to-amber-950/20">
            <CardHeader title="School holiday calendar" description="Enter day numbers separated by commas for the selected month. Saving updates the shared server calendar and recalculates working-day totals." />
            <div className="grid gap-4 p-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1.4fr)_auto] md:items-end">
                <Field label="Holiday month"><Input aria-label="Holiday month" type="month" value={holidayMonth} onChange={(event) => setHolidayMonth(event.target.value)} /></Field>
                <Field label="Holiday dates · comma-separated"><Input aria-label="Holiday day numbers" inputMode="numeric" placeholder="Example: 2, 14, 26" value={holidayDays} onChange={(event) => setHolidayDays(event.target.value)} /></Field>
                <Button onClick={saveHolidayCalendar} disabled={holidaySaving || !holidayMonth}><Save className="h-4 w-4" />{holidaySaving ? "Saving…" : "Save school holidays"}</Button>
                {holidayMessage ? <p role="status" className="text-sm text-slate-700 dark:text-slate-200 md:col-span-3">{holidayMessage}</p> : null}
                <p className="text-xs text-muted-foreground md:col-span-3">Example: <b>2, 14, 26</b>. Leave empty and save to clear the selected month. Saved holidays are shared with all staff.</p>
            </div>
        </Card>

        {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
        {isMachineUnavailable ? <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Machine attendance could not be confirmed.</p><p className="mt-1">{data.machineError} Refresh after the machine connection is restored. Printing is disabled so missing machine data is not shown as verified absence.</p></div></div> : null}
        {data?.holidayLoadErrors ? <div role="status" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>One or more saved holiday calendars could not be loaded. Working-day totals may be incomplete; check the school holiday calendar before filing.</p></div> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={CalendarDays} label="Working days · selected range" value={data ? selectedRangeWorkingDays : "—"} detail={formatShortDate(dateFrom) + " – " + formatShortDate(dateTo)} />
            <Metric icon={CheckCircle2} label={"Working days · " + getMonthTitle(dateTo)} value={data ? currentMonthWorkingDays : "—"} detail="Up to the report To date" />
            <Metric icon={Clock3} label={"Working days · " + getMonthTitle(previousMonth.start)} value={data ? previousMonthWorkingDays : "—"} detail="Previous full calendar month" />
            <Metric icon={BookOpenCheck} label="Working days · school session" value={data ? sessionWorkingDays : "—"} detail={formatShortDate(sessionStartDate) + " through " + formatShortDate(dateTo)} />
        </div>

        <Card className="overflow-hidden">
            <CardHeader title="Student register preview" description={filteredStudents.length + " students · names A to Z · session and month totals through " + formatShortDate(dateTo)} action={<Badge tone={attendanceFilter === "absent" ? "danger" : attendanceFilter === "present" ? "success" : "info"}>{attendanceFilter === "all" ? "All students" : attendanceFilter === "present" ? "Present" : "Absent"}</Badge>} />
            {loading && !data ? <div className="p-12 text-center text-sm text-muted-foreground">Loading student profiles and machine punches…</div> : error && !data ? <div className="p-12 text-center text-sm text-rose-700 dark:text-rose-300">{error}</div> : !data ? <div className="p-12 text-center text-sm text-muted-foreground"><CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />Choose dates and apply filters to load the register.</div> : !filteredStudents.length ? <div className="p-12 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-3 h-8 w-8 opacity-40" />No students match these filters.</div> : <div className="max-h-[72vh] overflow-auto">
                <table className="min-w-max border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-20 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300"><tr>
                        <th className="sticky left-0 z-30 min-w-12 border-b border-r bg-slate-100 px-3 py-3 dark:bg-slate-900">#</th><th className="sticky left-12 z-30 min-w-24 border-b border-r bg-slate-100 px-3 py-3 dark:bg-slate-900">ID No.</th><th className="sticky left-[9rem] z-30 min-w-48 border-b border-r bg-slate-100 px-3 py-3 dark:bg-slate-900">Student name</th><th className="min-w-28 border-b border-r px-3 py-3">Class &amp; section</th><th className="min-w-24 border-b border-r px-3 py-3">Status</th><th className="min-w-24 border-b border-r px-3 py-3">{getMonthTitle(dateTo)} P</th><th className="min-w-24 border-b border-r px-3 py-3">{getMonthTitle(previousMonth.start)} P</th><th className="min-w-28 border-b border-r px-3 py-3">Session P / W</th>
                        {selectedDates.map((date) => <th key={date} className="min-w-[5.5rem] border-b border-r px-2 py-2 text-center"><span className="block">{date.slice(8, 10)}-{date.slice(5, 7)}</span><span className="font-normal normal-case">{new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"))}</span></th>)}
                    </tr></thead>
                    <tbody>{filteredStudents.map((student, index) => <StudentRow key={student.id} student={student} index={index} dates={selectedDates} holidays={holidays} sessionWorkingDays={sessionWorkingDays} />)}</tbody>
                </table>
            </div>}
            {filteredStudents.length > 0 ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-3 text-[11px] text-muted-foreground dark:border-slate-800"><span><b className="text-emerald-700">Time</b> = first punch, seconds omitted</span><span><b className="text-rose-700">A</b> = absent on working day</span><span><b>—</b> = Sunday or saved holiday</span><span>P = days present · W = working days</span></div> : null}
        </Card>

        <Card className="border-sky-100 bg-gradient-to-r from-sky-50 via-white to-indigo-50 dark:border-sky-900/50 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900 dark:text-white">A4 landscape register</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Opens a clean print tab with the student summary and readable date-grid sheets. Use Ctrl+P (⌘P on Mac) and choose A4 · Landscape.</p><p className="mt-1 text-xs text-muted-foreground">The register provides school-record fields and signature lines. Verify the school calendar and approve/sign it under your school’s process before filing.</p></div><Button onClick={openPrintTab} disabled={loading || !data || isMachineUnavailable || !filteredStudents.length}><Printer className="h-4 w-4" />Open Print Register</Button></div>
        </Card>
    </div>;
}

function Field({ label, children }) {
    return <label className="grid gap-1.5 text-sm"><span className="font-medium text-foreground">{label}</span>{children}</label>;
}

function Metric({ icon: Icon, label, value, detail }) {
    return <Card className="overflow-hidden"><div className="flex items-start gap-3 p-4"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p></div></div></Card>;
}

function StudentRow({ student, index, dates, holidays, sessionWorkingDays }) {
    const attendance = new Map((student.attendance || []).map((day) => [day.date, day]));
    const hasSelectedPunch = student.selectedPresent > 0;
    return <tr className="odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-950 dark:even:bg-slate-900/40">
        <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-inherit px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-800">{index + 1}</td>
        <td className="sticky left-12 z-10 border-b border-r border-slate-100 bg-inherit px-3 py-2.5 font-medium tabular-nums text-slate-700 dark:border-slate-800 dark:text-slate-200">{student.studentCode || student.esslId || "—"}</td>
        <td className="sticky left-[9rem] z-10 border-b border-r border-slate-100 bg-inherit px-3 py-2.5 font-semibold text-slate-900 dark:border-slate-800 dark:text-white">{String(student.name || "").toLocaleUpperCase("en")}</td>
        <td className="border-b border-r border-slate-100 px-3 py-2.5 text-slate-600 dark:border-slate-800 dark:text-slate-300">{student.className}{student.section ? "-" + student.section : ""}</td>
        <td className="border-b border-r border-slate-100 px-3 py-2.5 dark:border-slate-800"><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase " + (hasSelectedPunch ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200" : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200")}>{hasSelectedPunch ? "Present" : "Absent"}</span></td>
        <td className="border-b border-r border-slate-100 px-3 py-2.5 text-center font-semibold tabular-nums text-emerald-800 dark:border-slate-800 dark:text-emerald-300">{student.currentMonthPresent}</td>
        <td className="border-b border-r border-slate-100 px-3 py-2.5 text-center font-semibold tabular-nums text-slate-700 dark:border-slate-800 dark:text-slate-200">{student.previousMonthPresent}</td>
        <td className="border-b border-r border-slate-100 px-3 py-2.5 text-center font-semibold tabular-nums text-indigo-800 dark:border-slate-800 dark:text-indigo-300">{student.sessionPresent} / {sessionWorkingDays}</td>
        {dates.map((date) => {
            const day = attendance.get(date);
            const punch = [...(day?.punches || [])].sort()[0];
            const working = isWorkingSchoolDay(date, holidays);
            const content = punch ? formatTime(punch) : working ? "A" : "—";
            const color = punch ? "font-semibold text-emerald-700 dark:text-emerald-300" : working ? "font-medium text-rose-600 dark:text-rose-300" : "text-slate-400";
            return <td key={date} className={"border-b border-r border-slate-100 px-2 py-2.5 text-center tabular-nums dark:border-slate-800 " + color}>{content}</td>;
        })}
    </tr>;
}
