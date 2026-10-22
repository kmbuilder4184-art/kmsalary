import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { decodeEsslXml, escapeEsslXml, getStudentEsslConfig } from "@/lib/essl-student-config";

export const dynamic = "force-dynamic";

// Reads eTimeTrackLite's recorded status for a previously queued machine command.
export async function POST(request) {
    const { response } = await requirePermission("employees.view");
    if (response) return response;

    const body = await request.json().catch(() => null);
    const commandId = String(body?.commandId || "").trim();
    if (!/^\d+$/.test(commandId)) {
        return NextResponse.json({ message: "Enter a valid numeric eSSL command ID." }, { status: 400 });
    }

    const config = getStudentEsslConfig();
    const soap = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetCommandStatus xmlns="http://tempuri.org/"><CommandId>${escapeEsslXml(commandId)}</CommandId><UserName>${escapeEsslXml(config.username)}</UserName><UserPassword>${escapeEsslXml(config.password)}</UserPassword></GetCommandStatus></soap:Body></soap:Envelope>`;

    try {
        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                SOAPAction: "http://tempuri.org/GetCommandStatus"
            },
            body: soap,
            cache: "no-store",
            signal: AbortSignal.timeout(12_000)
        });
        if (!response.ok) throw new Error(`eSSL server returned HTTP ${response.status}`);

        const xml = await response.text();
        const fault = xml.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
        if (fault) throw new Error(`eSSL rejected the status request: ${decodeEsslXml(fault[1])}`);

        const resultMatch = xml.match(/<(?:\w+:)?GetCommandStatusResult[^>]*>([\s\S]*?)<\/(?:\w+:)?GetCommandStatusResult>/i);
        const returnedCommandId = xml.match(/<(?:\w+:)?CommandId[^>]*>([\s\S]*?)<\/(?:\w+:)?CommandId>/i);
        const commandStatus = resultMatch ? decodeEsslXml(resultMatch[1]).trim() : "";
        if (!commandStatus) throw new Error("eSSL response did not include GetCommandStatusResult.");

        return NextResponse.json({
            success: true,
            commandId: returnedCommandId ? decodeEsslXml(returnedCommandId[1]).trim() : commandId,
            commandStatus,
            machineSerial: config.serialNumber
        });
    } catch (error) {
        console.error("Could not check eSSL command status:", error);
        return NextResponse.json({ message: error.message || "Could not check eSSL command status." }, { status: 502 });
    }
}
