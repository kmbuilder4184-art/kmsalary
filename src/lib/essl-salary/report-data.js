const ESSL_NOTE_PREFIX = "ESSL Calculator:";

// Store the calculator's exact line items in the existing salary notes field (no table migration needed).
export function createEsslSalaryNote(details, manualNotes = "") {
    return `${ESSL_NOTE_PREFIX} ${JSON.stringify({ version: 1, ...details, manualNotes: String(manualNotes || "") })}`;
}

export function parseEsslSalaryNote(notes) {
    const value = String(notes || "");
    if (!value.startsWith(ESSL_NOTE_PREFIX)) return null;
    try {
        const data = JSON.parse(value.slice(ESSL_NOTE_PREFIX.length).trim());
        return data?.version === 1 ? data : null;
    } catch {
        return null;
    }
}
