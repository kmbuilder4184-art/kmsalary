import { getSupabaseAdmin } from "@/lib/supabase";

export async function writeAuditLog({ action, actor, status = "Success", message = "", metadata = {}, request }) {
    try {
        const supabase = getSupabaseAdmin();
        await supabase.from("audit_logs").insert({
            action,
            actor_email: actor?.email ? String(actor.email).toLowerCase().trim() : "",
            actor_name: actor?.name ? String(actor.name).trim() : "",
            status,
            message: message ? String(message).trim() : "",
            metadata: metadata || {},
            ip_address: request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
            user_agent: request?.headers?.get("user-agent") || ""
        });
    } catch (error) {
        console.error("Audit log write failed", error);
    }
}

export function serializeAuditLog(log) {
    if (!log) return null;
    return {
        _id: String(log.id || log._id),
        id: String(log.id || log._id),
        action: String(log.action || ""),
        actorEmail: String(log.actor_email || log.actorEmail || ""),
        actorName: String(log.actor_name || log.actorName || ""),
        status: log.status === "Failed" ? "Failed" : "Success",
        message: String(log.message || ""),
        metadata: log.metadata || {},
        createdAt: log.created_at || log.createdAt ? new Date(log.created_at || log.createdAt).toISOString() : undefined
    };
}
