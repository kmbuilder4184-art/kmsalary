"use client";
import { Eye, EyeOff, KeyRound, RotateCcw, Save, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PageHeading } from "@/components/page-heading";

const permissionGroups = [
    { title: "Employee Access", items: [["employees.view", "View employees"], ["employees.create", "Create employees"], ["employees.edit", "Edit employees"], ["employees.delete", "Delete / inactive employees"]] },
    { title: "Salary Access", items: [["salary.view", "View salary"], ["salary.create", "Create salary"], ["salary.edit", "Edit salary"], ["salary.delete", "Delete salary"]] },
    { title: "Expense Entry Access", items: [["ledger.view", "View company expense"], ["ledger.create", "Create expense entries"], ["ledger.edit", "Close expense entries"], ["ledger.delete", "Delete expense entries"]] },
    { title: "Reports & Dashboard", items: [["dashboard.view", "Dashboard"], ["reports.view", "Reports"]] }
];

const blankUser = { name: "", email: "", password: "", permissions: ["dashboard.view", "employees.view", "salary.view", "ledger.view"] };

export function AdminClient() {
    const { notify } = useToast();
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [newUser, setNewUser] = useState(blankUser);
    const [passwordForm, setPasswordForm] = useState({ name: "", email: "", currentPassword: "", newPassword: "", confirmPassword: "" });
    const [editingUsers, setEditingUsers] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                setCurrentUser(data?.user || null);
                if (data?.user) {
                    setPasswordForm((current) => ({
                        ...current,
                        name: data.user.name || "",
                        email: data.user.email || ""
                    }));
                }
            })
            .catch(() => setCurrentUser(null));
        loadUsers();
    }, []);

    async function loadUsers() {
        const response = await fetch("/api/admin/users", { cache: "no-store" });
        const data = response.ok ? await response.json() : { users: [] };
        setUsers(data.users || []);
    }

    async function changePassword(event) {
        event.preventDefault();
        if (passwordForm.newPassword && passwordForm.newPassword !== passwordForm.confirmPassword) {
            notify({ tone: "error", title: "New password does not match" });
            return;
        }
        setSaving(true);
        const response = await fetch("/api/admin/password", {
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
        if (data?.user)
            setCurrentUser(data.user);
        notify({ tone: "success", title: "Administrator profile updated" });
    }

    async function createUser(event) {
        event.preventDefault();
        setSaving(true);
        const response = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newUser)
        });
        setSaving(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "User could not be created" });
            return;
        }
        setNewUser(blankUser);
        notify({ tone: "success", title: "User ID and password saved" });
        await loadUsers();
    }

    async function updateUser(user, patch) {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch)
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "User could not be updated" });
            return;
        }
        notify({ tone: "success", title: "User permissions updated" });
        await loadUsers();
    }

    async function disableUser(user) {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`, { method: "DELETE" });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            notify({ tone: "error", title: data?.message || "User could not be disabled" });
            return;
        }
        notify({ tone: "success", title: "User disabled" });
        await loadUsers();
    }
    async function saveUserProfile(user) {
        const draft = editingUsers[user.email] || {};
        const patch = {
            name: draft.name ?? user.name,
            status: draft.status ?? "Active"
        };
        if (draft.password) {
            patch.password = draft.password;
        }
        await updateUser(user, patch);
        setEditingUsers((current) => ({ ...current, [user.email]: { name: patch.name, password: "", status: patch.status } }));
    }
    function setUserDraft(user, patch) {
        setEditingUsers((current) => ({
            ...current,
            [user.email]: {
                name: user.name,
                password: "",
                status: "Active",
                ...(current[user.email] || {}),
                ...patch
            }
        }));
    }

    return (<>
      <PageHeading title="Admin Settings" description="Change administrator password and create users with controlled permissions."/>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        <Card>
          <CardHeader title="Administrator Account" description="Update admin name, user ID/email, and password. Current password is required."/>
          <form onSubmit={changePassword} className="grid gap-4 p-5" autoComplete="off">
            <Field label="Admin Name">
              <Input name="admin-display-name" autoComplete="off" value={passwordForm.name} onChange={(event) => setPasswordForm({ ...passwordForm, name: event.target.value })} required/>
            </Field>
            <Field label="Admin User ID / Email">
              <Input name="admin-user-id-email" autoComplete="off" type="email" value={passwordForm.email} onChange={(event) => setPasswordForm({ ...passwordForm, email: event.target.value })} required/>
            </Field>
            <PasswordField label="Current Password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })}/>
            <PasswordField label="New Password" value={passwordForm.newPassword} required={false} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}/>
            <PasswordField label="Confirm New Password" value={passwordForm.confirmPassword} required={false} onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}/>
            <Button type="submit" disabled={saving}>
              <KeyRound className="h-4 w-4"/>
              Save Admin Account
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Create User ID" description="Give only selected access to the second user."/>
          <form onSubmit={createUser} className="grid gap-5 p-5" autoComplete="off">
            <input className="hidden" type="text" name="fake-user-id" autoComplete="username"/>
            <input className="hidden" type="password" name="fake-user-password" autoComplete="new-password"/>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="User Name">
                <Input name="second-user-name" autoComplete="off" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} required placeholder="User display name"/>
              </Field>
              <Field label="User ID / Email">
                <Input name="second-user-email" autoComplete="off" type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required placeholder="user@kmbuilders.com"/>
              </Field>
              <PasswordField label="Password" value={newUser.password} autoComplete="new-password" onChange={(value) => setNewUser({ ...newUser, password: value })}/>
            </div>
            <div>
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Select User Permissions</p>
              <PermissionPicker value={newUser.permissions} onChange={(permissions) => setNewUser({ ...newUser, permissions })} cols="grid-cols-1 sm:grid-cols-2"/>
            </div>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto sm:self-start">
              <UserPlus className="h-4 w-4"/>
              Save User Access
            </Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Created Users" description="Tick/untick permissions any time. Changes save immediately; name/password can be updated from each user card."/>
        {users.filter((user) => user.role !== "Admin").length === 0 ? (<EmptyState title="No second user created" description="Create a user ID and choose permissions above."/>) : (<div className="grid gap-4 p-5">
            {users.filter((user) => user.role !== "Admin").map((user) => {
                const draft = editingUsers[user.email] || {};
                const status = draft.status || user.status || "Active";
                return (<div key={user.email} className="rounded-xl border border-border bg-white/35 p-4 dark:bg-white/5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => saveUserProfile(user)}>
                      <Save className="h-4 w-4"/>
                      Save User
                    </Button>
                    <Button variant={status === "Inactive" ? "secondary" : "danger"} size="sm" onClick={() => status === "Inactive" ? updateUser(user, { status: "Active" }) : disableUser(user)}>
                      {status === "Inactive" ? <RotateCcw className="h-4 w-4"/> : null}
                      {status === "Inactive" ? "Restore User" : "Disable User"}
                    </Button>
                  </div>
                </div>
                <div className="mb-4 grid gap-4 sm:grid-cols-3">
                  <Field label="Display Name">
                    <Input value={draft.name ?? user.name} onChange={(event) => setUserDraft(user, { name: event.target.value })}/>
                  </Field>
                  <PasswordField label="Reset Password" value={draft.password || ""} required={false} onChange={(value) => setUserDraft(user, { password: value })}/>
                  <Field label="Status">
                    <select className="h-10 w-full rounded-lg border border-white/55 bg-white/58 px-3 py-2 text-sm text-foreground shadow-sm outline-none backdrop-blur-xl transition dark:border-white/10 dark:bg-white/10" value={status} onChange={(event) => setUserDraft(user, { status: event.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </Field>
                </div>
                <PermissionPicker value={user.permissions || []} onChange={(permissions) => updateUser(user, { permissions })} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"/>
              </div>);
            })}
          </div>)}
      </Card>
    </>);
}

function PermissionPicker({ value, onChange, cols = "grid-cols-1 sm:grid-cols-2" }) {
    function toggle(permission) {
        const next = value.includes(permission) ? value.filter((item) => item !== permission) : [...value, permission];
        onChange(next);
    }
    return (<div className={`grid gap-3.5 ${cols}`}>
      {permissionGroups.map((group) => (<div key={group.title} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2.5 border-b border-slate-100 pb-2.5 dark:border-white/10">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <ShieldCheck className="h-4 w-4 shrink-0"/>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {group.title}
            </p>
          </div>
          <div className="grid gap-1.5">
            {group.items.map(([permission, label]) => {
                const checked = value.includes(permission);
                return (<label key={permission} className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer select-none ${checked ? "bg-blue-50/80 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200" : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-white/5"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(permission)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"/>
                <span className="text-xs font-medium leading-snug break-words">
                  {label}
                </span>
              </label>);
            })}
          </div>
        </div>))}
    </div>);
}

function PasswordField({ label, value, onChange, required = true, autoComplete = "new-password" }) {
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;
    return (<Field label={label}>
      <div className="relative">
        <Input className="pr-10" name={`password-${label.replace(/\W+/g, "-").toLowerCase()}`} autoComplete={autoComplete} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required={required}/>
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"}>
          <Icon className="h-4 w-4"/>
        </button>
      </div>
    </Field>);
}
