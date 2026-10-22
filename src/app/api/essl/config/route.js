import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyDeveloperToken } from "@/lib/developer-auth";

export const dynamic = "force-dynamic";

const DEFAULT_BRANCH_1 = {
    name: "Branch 1 (Head Office)",
    endpoint: process.env.ESSL_API_URL_BRANCH_1 || process.env.ESSL_API_URL || "https://isopentyl-immersed-cecelia.ngrok-free.dev/iclock/WebAPIService.asmx",
    serialNumber: process.env.ESSL_SERIAL_NUMBER_BRANCH_1 || process.env.ESSL_SERIAL_NUMBER || "NfZ8243803928",
    username: process.env.ESSL_API_USERNAME_BRANCH_1 || process.env.ESSL_API_USERNAME || "api",
    password: process.env.ESSL_API_PASSWORD_BRANCH_1 || process.env.ESSL_API_PASSWORD || "Akash@8299"
};

const DEFAULT_BRANCH_2 = {
    name: "Branch 2 (Site Office)",
    endpoint: process.env.ESSL_API_URL_BRANCH_2 || "",
    serialNumber: process.env.ESSL_SERIAL_NUMBER_BRANCH_2 || "",
    username: process.env.ESSL_API_USERNAME_BRANCH_2 || "api",
    password: process.env.ESSL_API_PASSWORD_BRANCH_2 || ""
};

async function testConnection(endpoint) {
    if (!endpoint || !endpoint.startsWith("http")) {
        return "Not Configured";
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(endpoint, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store"
        });
        clearTimeout(timeoutId);
        if (response.ok || response.status === 405 || response.status === 200) {
            return "Connected";
        }
        return `Error: HTTP ${response.status}`;
    } catch (error) {
        return "Error: Server Unreachable";
    }
}

export async function GET(request) {
    const isDeveloper = await verifyDeveloperToken(request);
    if (!isDeveloper) {
        return NextResponse.json(
            {
                message: "Developer authentication required to view biometric device configuration.",
                requireDeveloperAuth: true
            },
            { status: 403 }
        );
    }

    const supabase = getSupabaseAdmin();

    try {
        const { data: settingsRows } = await supabase
            .from("settings")
            .select("key, value")
            .in("key", ["essl_config_branch_1", "essl_config_branch_2", "essl_last_sync_branch_1", "essl_last_sync_branch_2", "essl_last_sync"]);

        const settingsMap = {};
        (settingsRows || []).forEach(row => {
            settingsMap[row.key] = row.value;
        });

        const branch1Config = {
            ...DEFAULT_BRANCH_1,
            ...(settingsMap.essl_config_branch_1 || {})
        };

        const branch2Config = {
            ...DEFAULT_BRANCH_2,
            ...(settingsMap.essl_config_branch_2 || {})
        };

        const lastSync1 = settingsMap.essl_last_sync_branch_1?.time || settingsMap.essl_last_sync?.time || null;
        const lastSync2 = settingsMap.essl_last_sync_branch_2?.time || null;

        const [status1, status2] = await Promise.all([
            testConnection(branch1Config.endpoint),
            testConnection(branch2Config.endpoint)
        ]);

        return NextResponse.json({
            branch1: {
                ...branch1Config,
                password: branch1Config.password ? "••••••••" : "",
                hasPassword: Boolean(branch1Config.password),
                status: status1,
                lastSync: lastSync1
            },
            branch2: {
                ...branch2Config,
                password: branch2Config.password ? "••••••••" : "",
                hasPassword: Boolean(branch2Config.password),
                status: status2,
                lastSync: lastSync2
            }
        });
    } catch (error) {
        console.error("eSSL Config GET error:", error);
        return NextResponse.json({ message: "Failed to read eSSL configuration", error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const { action, branch, config } = body;
    const now = new Date().toISOString();

    try {
        if (action === "save_config") {
            const isDeveloper = await verifyDeveloperToken(request);
            if (!isDeveloper) {
                return NextResponse.json(
                    {
                        message: "Developer authentication required to save biometric device configuration.",
                        requireDeveloperAuth: true
                    },
                    { status: 403 }
                );
            }

            const key = branch === "branch2" ? "essl_config_branch_2" : "essl_config_branch_1";
            
            const { data: existing } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
            const existingVal = existing?.value || (branch === "branch2" ? DEFAULT_BRANCH_2 : DEFAULT_BRANCH_1);
            
            const updatedConfig = {
                name: config.name?.trim() || (branch === "branch2" ? "Branch 2" : "Branch 1"),
                endpoint: config.endpoint?.trim() || "",
                serialNumber: config.serialNumber?.trim() || "",
                username: config.username?.trim() || "api",
                password: (config.password && config.password !== "••••••••") ? config.password : (existingVal.password || "")
            };

            await supabase.from("settings").upsert({
                key,
                value: updatedConfig
            }, { onConflict: "key" });

            return NextResponse.json({ success: true, message: "Configuration saved successfully." });
        }

        const targetBranch = branch || "all";
        const updates = [];

        if (targetBranch === "branch1" || targetBranch === "all") {
            updates.push(
                supabase.from("settings").upsert({
                    key: "essl_last_sync_branch_1",
                    value: { time: now }
                }, { onConflict: "key" })
            );
            updates.push(
                supabase.from("settings").upsert({
                    key: "essl_last_sync",
                    value: { time: now }
                }, { onConflict: "key" })
            );
        }

        if (targetBranch === "branch2" || targetBranch === "all") {
            updates.push(
                supabase.from("settings").upsert({
                    key: "essl_last_sync_branch_2",
                    value: { time: now }
                }, { onConflict: "key" })
            );
        }

        await Promise.all(updates);

        return NextResponse.json({ success: true, lastSync: now, message: "Sync status recorded." });
    } catch (error) {
        console.error("eSSL Config POST error:", error);
        return NextResponse.json({ message: "Operation failed", error: error.message }, { status: 500 });
    }
}
