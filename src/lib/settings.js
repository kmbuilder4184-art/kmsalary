import { getSupabaseAdmin } from "@/lib/supabase";
import { decryptSecret, encryptSecret } from "@/lib/secure-settings";

const SCHOOL_KEY = "companyInfo";
const SMTP_KEY = "smtpSettings";

const defaultSchoolInfo = {
    name: "KM Builders",
    address: "",
    phone: "",
    email: "",
    website: ""
};

const defaultSmtpSettings = {
    host: "smtp.gmail.com",
    port: 465,
    email: "",
    passwordEncrypted: "",
    fromName: "KM Builders"
};

export async function getSchoolInfo() {
    try {
        const supabase = getSupabaseAdmin();
        const { data: doc } = await supabase
            .from("settings")
            .select("value")
            .eq("key", SCHOOL_KEY)
            .maybeSingle();

        return { ...defaultSchoolInfo, ...(doc?.value || {}) };
    } catch {
        return { ...defaultSchoolInfo };
    }
}

export async function saveSchoolInfo(value) {
    const next = { ...defaultSchoolInfo, ...value };
    const supabase = getSupabaseAdmin();
    await supabase
        .from("settings")
        .upsert({ key: SCHOOL_KEY, value: next }, { onConflict: "key" });
    return next;
}

export async function getSmtpSettings({ includePassword = false } = {}) {
    try {
        const supabase = getSupabaseAdmin();
        const { data: doc } = await supabase
            .from("settings")
            .select("value")
            .eq("key", SMTP_KEY)
            .maybeSingle();

        const settings = { ...defaultSmtpSettings, ...(doc?.value || {}) };
        const password = includePassword ? decryptSecret(settings.passwordEncrypted) : "";
        return {
            host: settings.host,
            port: Number(settings.port || 587),
            email: settings.email || "",
            password,
            fromName: settings.fromName || defaultSmtpSettings.fromName,
            configured: Boolean(settings.host && settings.port && settings.email && settings.passwordEncrypted)
        };
    } catch {
        return {
            ...defaultSmtpSettings,
            password: "",
            configured: false
        };
    }
}

export async function saveSmtpSettings(value) {
    const current = await getSmtpSettings({ includePassword: false });
    const supabase = getSupabaseAdmin();

    const { data: currentDoc } = await supabase
        .from("settings")
        .select("value")
        .eq("key", SMTP_KEY)
        .maybeSingle();

    const next = {
        host: value.host,
        port: Number(value.port),
        email: value.email,
        passwordEncrypted: value.password
            ? encryptSecret(value.password)
            : currentDoc?.value?.passwordEncrypted || "",
        fromName: value.fromName
    };

    await supabase
        .from("settings")
        .upsert({ key: SMTP_KEY, value: next }, { onConflict: "key" });

    return {
        ...current,
        ...next,
        password: "",
        configured: Boolean(next.host && next.port && next.email && next.passwordEncrypted)
    };
}
