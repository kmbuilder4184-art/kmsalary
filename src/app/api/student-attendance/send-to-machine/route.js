import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/server-auth";
import { createEsslCommandId, decodeEsslXml, escapeEsslXml, getStudentEsslConfig } from "@/lib/essl-student-config";

export const dynamic = "force-dynamic";

// Sends the saved student's basic identity to eTimeTrackLite for the student device.
export async function POST(request) {
    const { response } = await requirePermission("employees.create");
    if (response) return response;

    const body = await request.json().catch(() => null);
    const studentId = String(body?.studentId || "").trim();
    if (!studentId) return NextResponse.json({ message: "Student profile ID is required." }, { status: 400 });

    const { data: student, error: studentError } = await getSupabaseAdmin()
        .from("students")
        .select("id,student_code,name,biometric_id")
        .eq("id", studentId)
        .maybeSingle();
    if (studentError) return NextResponse.json({ message: "Could not load the student profile.", error: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ message: "Student profile not found." }, { status: 404 });

    try {
        const config = getStudentEsslConfig();
        const commandId = createEsslCommandId();
        // AddEmployee queues the ID, name and optional card number for the given device.
        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                SOAPAction: "http://tempuri.org/AddEmployee"
            },
            body: buildAddEmployeeRequest(student, config, commandId),
            cache: "no-store",
            signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok) throw new Error(`eSSL server returned HTTP ${response.status}`);

        const xml = await response.text();
        const fault = xml.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
        if (fault) throw new Error(`eSSL rejected the request: ${decodeEsslXml(fault[1])}`);
        const resultMatch = xml.match(/<(?:\w+:)?AddEmployeeResult[^>]*>([\s\S]*?)<\/(?:\w+:)?AddEmployeeResult>/i);
        const commandMatch = xml.match(/<(?:\w+:)?CommandId[^>]*>([\s\S]*?)<\/(?:\w+:)?CommandId>/i);
        const result = resultMatch ? decodeEsslXml(resultMatch[1]).trim() : "";
        const returnedCommandId = commandMatch ? decodeEsslXml(commandMatch[1]).trim() : "";

        if (!result) throw new Error("eSSL response did not include AddEmployeeResult; the machine update could not be confirmed.");
        if (/fail|invalid|error|denied|not found|unauthori[sz]ed|unathori[sz]ed|^false$|^0$/i.test(result) || !/success|added|queued|command|^true$|^1$/i.test(result)) {
            throw new Error(`eSSL did not confirm the machine update: ${result}`);
        }

        return NextResponse.json({
            success: true,
            message: "eSSL server accepted the AddEmployee request. Check the command status to confirm whether the device processed it.",
            machineSerial: config.serialNumber,
            biometricId: student.biometric_id,
            commandId: returnedCommandId || commandId,
            machineResult: result
        });
    } catch (error) {
        console.error("Could not send student profile to eSSL machine:", error);
        const machineSerial = getStudentEsslConfig().serialNumber;
        const unauthorized = /unauthori[sz]ed|unathori[sz]ed|invalid user|authentication/i.test(error.message || "");
        const message = unauthorized
            ? `eSSL ne request reject ki: ${error.message}. API key, username/password, aur serial number ${machineSerial} ki API permission verify karni hogi.`
            : error.message || "Could not send the student profile to the machine.";
        return NextResponse.json({
            message,
            profileSaved: true,
            biometricId: student.biometric_id,
            machineSerial,
            machineResult: unauthorized ? "Unathorised User" : undefined
        }, { status: 502 });
    }
}

// Builds the documented eSSL AddEmployee SOAP request.
function buildAddEmployeeRequest(student, config, commandId) {
    const employeeCode = student.biometric_id || student.student_code || "";
    const employeeName = student.name || "";
    // student_code holds the admission/roll number when available, like CardNumber in the API payload.
    const cardNumber = student.student_code || student.biometric_id || "";
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><AddEmployee xmlns="http://tempuri.org/"><APIKey>${escapeEsslXml(config.apiKey)}</APIKey><EmployeeCode>${escapeEsslXml(employeeCode)}</EmployeeCode><EmployeeName>${escapeEsslXml(employeeName)}</EmployeeName><CardNumber>${escapeEsslXml(cardNumber)}</CardNumber><SerialNumber>${escapeEsslXml(config.serialNumber)}</SerialNumber><UserName>${escapeEsslXml(config.username)}</UserName><UserPassword>${escapeEsslXml(config.password)}</UserPassword><CommandId>${escapeEsslXml(commandId)}</CommandId></AddEmployee></soap:Body></soap:Envelope>`;
}
