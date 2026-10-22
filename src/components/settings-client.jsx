"use client";
import { Download, KeyRound, Mail, RefreshCw, Save, Send, ShieldCheck, Upload, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const blankUser = { name: "", email: "", password: "", permissions: ["dashboard.view", "employees.view", "salary.view", "reports.view"] };

export function SettingsClient() {
    const { notify } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [schoolInfo, setSchoolInfo] = useState({ name: "", address: "", phone: "", email: "", website: "" });
    const [smtpSettings, setSmtpSettings] = useState({ host: "smtp.gmail.com", port: 465, email: "", password: "", fromName: "" });
    const [testEmail, setTestEmail] = useState("");
    const [passwordForm, setPasswordForm] = useState({ name: "", email: "", currentPassword: "", newPassword: "", confirmPassword: "" });
    const [accountant, setAccountant] = useState(blankUser);
    const [sessions, setSessions] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [systemInfo, setSystemInfo] = useState(null);
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreConfirmation, setRestoreConfirmation] = useState("");

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        setLoading(true);
        const [meResponse, settingsResponse, usersResponse, sessionsResponse] = await Promise.all([
            fetch("/api/auth/me", { cache: "no-store" }),
            fetch("/api/settings", { cache: "no-store" }),
            fetch("/api/admin/users", { cache: "no-store" }),
            fetch("/api/settings/security/sessions", { cache: "no-store" })
        ]);
        const me = meResponse.ok ? await meResponse.json() : null;
        const settings = settingsResponse.ok ? await settingsResponse.json() : {};
        const userData = usersResponse.ok ? await usersResponse.json() : { users: [] };
        const sessionData = sessionsResponse.ok ? await sessionsResponse.json() : { sessions: [] };
        setCurrentUser(me?.user || null);
        setSchoolInfo(settings.schoolInfo || schoolInfo);
        setSmtpSettings({ ...(settings.smtpSettings || smtpSettings), password: "" });
        setAuditLogs(settings.auditLogs || []);
        setSystemInfo(settings.systemInfo || null);
        setUsers(userData.users || []);
        setSessions(sessionData.sessions || []);
        if (me?.user) {
            setPasswordForm((current) => ({ ...current, name: me.user.name || "", email: me.user.email || "" }));
        }
        setLoading(false);
    }

    async function saveSettings(payload, success) {
        setSaving(true);
        const response = await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Settings could not be saved" });
            return;
        }
        notify({ tone: "success", title: success });
        await loadAll();
    }

    async function changePassword(event) {
        event.preventDefault();
        if (passwordForm.newPassword && passwordForm.newPassword !== passwordForm.confirmPassword) {
            notify({ tone: "error", title: "New password does not match" });
            return;
        }
        setSaving(true);
        const response = await fetch("/api/settings/security/password", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(passwordForm)
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Password could not be changed" });
            return;
        }
        setPasswordForm((current) => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
        notify({ tone: "success", title: "Admin account updated" });
        await loadAll();
    }

    async function createAccountant(event) {
        event.preventDefault();
        setSaving(true);
        const response = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accountant)
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Accountant account could not be saved" });
            return;
        }
        setAccountant(blankUser);
        notify({ tone: "success", title: "Accountant account saved" });
        await loadAll();
    }

    async function sendTestEmail(event) {
        event.preventDefault();
        setSaving(true);
        const response = await fetch("/api/settings/email/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: testEmail })
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        notify({ tone: response.ok ? "success" : "error", title: response.ok ? "Test email sent" : data?.message || "Test email failed" });
    }

    async function logoutAllDevices() {
        if (!window.confirm("This will sign out this account on every device. Continue?"))
            return;
        const response = await fetch("/api/settings/security/logout-all", { method: "POST" });
        if (response.ok) {
            window.location.href = "/login";
            return;
        }
        notify({ tone: "error", title: "Could not log out all devices" });
    }

    async function restoreBackup(event) {
        event.preventDefault();
        if (!restoreFile) {
            notify({ tone: "error", title: "Choose a backup .json.gz or .json file" });
            return;
        }
        if (restoreConfirmation !== "RESTORE") {
            notify({ tone: "error", title: "Type RESTORE to confirm" });
            return;
        }
        if (!window.confirm("Restore will replace current database data with the selected backup. Continue?"))
            return;
        const formData = new FormData();
        formData.append("file", restoreFile);
        formData.append("confirmation", restoreConfirmation);
        setSaving(true);
        const response = await fetch("/api/settings/restore", {
            method: "POST",
            body: formData
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "Restore failed" });
            return;
        }
        notify({ tone: "success", title: "Complete database backup restored" });
        await loadAll();
    }

    const accountantUsers = users.filter((user) => user.role !== "Admin");

    return (<>
      <PageHeading title="Settings" description="Manage company profile, accounts, email, backups, security, and system status."/>

      <div className="grid gap-6">
        <Card>
          <CardHeader title="Company Information" description="Used across the salary management system."/>
          <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              saveSettings({ schoolInfo }, "Company information saved");
          }}>
            <Field label="Company Name"><Input value={schoolInfo.name} onChange={(event) => setSchoolInfo({ ...schoolInfo, name: event.target.value })} required/></Field>
            <Field label="Email"><Input type="email" value={schoolInfo.email} onChange={(event) => setSchoolInfo({ ...schoolInfo, email: event.target.value })}/></Field>
            <Field label="Phone"><Input value={schoolInfo.phone} onChange={(event) => setSchoolInfo({ ...schoolInfo, phone: event.target.value })}/></Field>
            <Field label="Website"><Input value={schoolInfo.website} onChange={(event) => setSchoolInfo({ ...schoolInfo, website: event.target.value })}/></Field>
            <Field label="Address"><Textarea value={schoolInfo.address} onChange={(event) => setSchoolInfo({ ...schoolInfo, address: event.target.value })} required/></Field>
            <div className="flex items-end"><Button type="submit" disabled={saving}><Save className="h-4 w-4"/>Save Company Info</Button></div>
          </form>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Admin Account" description="Update your admin profile and password."/>
            <form onSubmit={changePassword} className="grid gap-4 p-5">
              <Field label="Admin Name"><Input value={passwordForm.name} onChange={(event) => setPasswordForm({ ...passwordForm, name: event.target.value })} required/></Field>
              <Field label="Admin Email"><Input type="email" value={passwordForm.email} onChange={(event) => setPasswordForm({ ...passwordForm, email: event.target.value })} required/></Field>
              <Field label="Current Password"><Input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required/></Field>
              <Field label="New Password"><Input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}/></Field>
              <Field label="Confirm New Password"><Input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}/></Field>
              <Button type="submit" disabled={saving}><KeyRound className="h-4 w-4"/>Save Admin Account</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Accountant Account" description="Create an accountant/user account with existing limited permissions."/>
            <form onSubmit={createAccountant} className="grid gap-4 p-5">
              <Field label="Name"><Input value={accountant.name} onChange={(event) => setAccountant({ ...accountant, name: event.target.value })} required/></Field>
              <Field label="Email"><Input type="email" value={accountant.email} onChange={(event) => setAccountant({ ...accountant, email: event.target.value })} required/></Field>
              <Field label="Password"><Input type="password" value={accountant.password} onChange={(event) => setAccountant({ ...accountant, password: event.target.value })} required/></Field>
              <Button type="submit" disabled={saving}><UserPlus className="h-4 w-4"/>Save Accountant</Button>
              <div className="rounded-lg border border-border bg-white/35 p-3 text-sm text-muted-foreground dark:bg-white/5">
                Existing accountant/user accounts: {accountantUsers.length || "None"}
              </div>
            </form>
          </Card>
        </div>

        <Card>
          <CardHeader title="Email Settings (SMTP)" description="Gmail SMTP credentials are encrypted before storage."/>
          <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              saveSettings({ smtpSettings }, "Email settings saved");
          }}>
            <Field label="SMTP Host"><Input value={smtpSettings.host} onChange={(event) => setSmtpSettings({ ...smtpSettings, host: event.target.value })} required/></Field>
            <Field label="SMTP Port"><Input type="number" value={smtpSettings.port} onChange={(event) => setSmtpSettings({ ...smtpSettings, port: event.target.value })} required/></Field>
            <Field label="Email"><Input type="email" value={smtpSettings.email} onChange={(event) => setSmtpSettings({ ...smtpSettings, email: event.target.value })} required/></Field>
            <Field label="Password"><Input type="password" value={smtpSettings.password} onChange={(event) => setSmtpSettings({ ...smtpSettings, password: event.target.value })} placeholder="Leave blank to keep saved password"/></Field>
            <Field label="From Name"><Input value={smtpSettings.fromName} onChange={(event) => setSmtpSettings({ ...smtpSettings, fromName: event.target.value })} required/></Field>
            <div className="flex items-end"><Button type="submit" disabled={saving}><Save className="h-4 w-4"/>Save SMTP</Button></div>
          </form>
          <form className="flex flex-col gap-3 border-t border-white/45 p-5 sm:flex-row dark:border-white/10" onSubmit={sendTestEmail}>
            <Input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Test recipient email" required/>
            <Button type="submit" disabled={saving}><Send className="h-4 w-4"/>Test Email</Button>
          </form>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Backup & Restore" description="Downloads a complete compressed MongoDB backup with all app collections."/>
            <div className="grid gap-4 p-5">
              <a href="/api/settings/backup/download" className="inline-flex w-fit">
                <Button><Download className="h-4 w-4"/>Create & Download Complete Backup</Button>
              </a>
              <form className="grid gap-4" onSubmit={restoreBackup}>
                <Field label="Restore Complete Backup"><Input type="file" accept="application/gzip,application/json,.gz,.json,.json.gz" onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}/></Field>
                <Field label="Confirmation"><Input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} placeholder="Type RESTORE"/></Field>
                <Button type="submit" variant="danger" disabled={saving}><Upload className="h-4 w-4"/>Restore Backup</Button>
              </form>
            </div>
          </Card>

          <Card>
            <CardHeader title="Security" description="Change password, revoke sessions, and review active devices."/>
            <div className="grid gap-4 p-5">
              <Button variant="danger" onClick={logoutAllDevices}><ShieldCheck className="h-4 w-4"/>Logout All Devices</Button>
              <div className="grid gap-3">
                {sessions.map((session) => (<div key={session.sessionId} className="rounded-lg border border-border bg-white/35 p-3 text-sm dark:bg-white/5">
                  <p className="font-medium">{session.current ? "Current session" : "Active session"}</p>
                  <p className="text-muted-foreground">{session.userAgent || "Unknown browser"}</p>
                  <p className="text-xs text-muted-foreground">Last seen: {formatDate(session.lastSeenAt)}</p>
                </div>))}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="System Information" description="Runtime and database status." action={<Button variant="secondary" onClick={loadAll} disabled={loading}><RefreshCw className="h-4 w-4"/>Refresh</Button>}/>
          <div className="grid gap-3 p-5 text-sm md:grid-cols-3">
            <Info label="App Version" value={systemInfo?.appVersion}/>
            <Info label="MongoDB Status" value={systemInfo?.mongoStatus}/>
            <Info label="Database Name" value={systemInfo?.databaseName}/>
            <Info label="Storage Usage" value={formatBytes(systemInfo?.storageUsage?.storageSize)}/>
            <Info label="Collections" value={systemInfo?.storageUsage?.collections}/>
            <Info label="Node Version" value={systemInfo?.nodeVersion}/>
          </div>
        </Card>

        <Card>
          <CardHeader title="Audit Log" description="Login, password change, backup, and restore activity."/>
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Time</th><th>Action</th><th>Actor</th><th>Status</th><th>Message</th></tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (<tr key={log._id} className="border-t border-border">
                  <td className="py-3">{formatDate(log.createdAt)}</td>
                  <td>{log.action}</td>
                  <td>{log.actorName || log.actorEmail || "-"}</td>
                  <td>{log.status}</td>
                  <td>{log.message || "-"}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>);
}

function Info({ label, value }) {
    return (<div className="rounded-lg border border-border bg-white/35 p-3 dark:bg-white/5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value || "Unavailable"}</p>
    </div>);
}

function formatDate(value) {
    if (!value)
        return "-";
    return new Date(value).toLocaleString();
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes)
        return "Unavailable";
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
