// Keep the student device settings consistent across profile writes and attendance reads.
export function getStudentEsslConfig() {
    return {
        serialNumber: process.env.ESSL_STUDENT_SERIAL_NUMBER || "TBS2262000975",
        // Match the exact WebAPIService path shown in the eSSL browser tab (including //iclock).
        endpoint: process.env.ESSL_STUDENT_API_URL || process.env.ESSL_API_URL || "https://isopentyl-immersed-cecelia.ngrok-free.dev//iclock/WebAPIService.asmx",
        apiKey: process.env.ESSL_STUDENT_API_KEY || process.env.ESSL_API_KEY || "11",
        username: process.env.ESSL_STUDENT_API_USERNAME || process.env.ESSL_API_USERNAME || "api",
        password: process.env.ESSL_STUDENT_API_PASSWORD || process.env.ESSL_API_PASSWORD || ""
    };
}

// eTimeTrackLite expects a positive numeric command identifier for queued operations.
export function createEsslCommandId() {
    return String(Date.now() % 2147483647 || 1);
}

export function escapeEsslXml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function decodeEsslXml(value) {
    return String(value ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
