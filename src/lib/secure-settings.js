import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

export function encryptSecret(value) {
    if (!value)
        return "";
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value) {
    if (!value)
        return "";
    const [iv, tag, encrypted] = String(value).split(".");
    if (!iv || !tag || !encrypted)
        return "";
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64")),
        decipher.final()
    ]).toString("utf8");
}

function encryptionKey() {
    const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
        throw new Error("SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required to encrypt settings.");
    }
    return crypto.createHash("sha256").update(secret || "development-settings-key-change-before-production").digest();
}
