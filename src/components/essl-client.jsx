"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import {
    Server,
    RefreshCw,
    Save,
    CheckCircle2,
    AlertCircle,
    Building2,
    ShieldCheck,
    Lock,
    Unlock,
    KeyRound,
    Eye,
    EyeOff,
    ShieldAlert,
    Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function EsslClient() {
    const { notify } = useToast();
    
    // Developer security states
    const [isDeveloperAuthenticated, setIsDeveloperAuthenticated] = useState(null); // null = checking, true/false
    const [developerPassword, setDeveloperPassword] = useState("");
    const [verifyingPassword, setVerifyingPassword] = useState(false);
    const [authError, setAuthError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Configuration states
    const [loading, setLoading] = useState(false);
    const [syncingBranch1, setSyncingBranch1] = useState(false);
    const [syncingBranch2, setSyncingBranch2] = useState(false);
    const [syncingAll, setSyncingAll] = useState(false);

    const [branch1, setBranch1] = useState({
        name: "Branch 1 (Head Office)",
        endpoint: "",
        serialNumber: "",
        username: "api",
        password: "",
        status: "Checking...",
        lastSync: "Loading..."
    });

    const [branch2, setBranch2] = useState({
        name: "Branch 2 (Site Office)",
        endpoint: "",
        serialNumber: "",
        username: "api",
        password: "",
        status: "Checking...",
        lastSync: "Loading..."
    });

    const [savingBranch1, setSavingBranch1] = useState(false);
    const [savingBranch2, setSavingBranch2] = useState(false);

    // Check if developer token is already valid in cookie
    useEffect(() => {
        fetch("/api/essl/developer-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "check" })
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.authenticated) {
                    setIsDeveloperAuthenticated(true);
                    loadConfig();
                } else {
                    setIsDeveloperAuthenticated(false);
                }
            })
            .catch(() => {
                setIsDeveloperAuthenticated(false);
            });
    }, []);

    async function handleDeveloperVerify(e) {
        if (e) e.preventDefault();
        if (!developerPassword) return;

        setVerifyingPassword(true);
        setAuthError("");

        try {
            const res = await fetch("/api/essl/developer-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "verify",
                    password: developerPassword
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Invalid Developer Key. Access Denied.");
            }

            setIsDeveloperAuthenticated(true);
            setDeveloperPassword("");
            notify({
                tone: "success",
                title: "Developer Access Granted",
                description: "Biometric infrastructure unlocked."
            });
            loadConfig();
        } catch (error) {
            setAuthError(error.message);
            notify({
                tone: "error",
                title: "Access Denied",
                description: error.message
            });
        } finally {
            setVerifyingPassword(false);
        }
    }

    async function handleLock() {
        try {
            await fetch("/api/essl/developer-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "lock" })
            });
        } catch (err) {
            console.error("Lock error:", err);
        }
        setIsDeveloperAuthenticated(false);
        setDeveloperPassword("");
        notify({
            tone: "info",
            title: "Developer Gate Locked",
            description: "Enter developer key again to access."
        });
    }

    async function loadConfig() {
        setLoading(true);
        try {
            const res = await fetch("/api/essl/config", { cache: "no-store" });
            const data = await res.json();
            
            if (res.status === 403 || data.requireDeveloperAuth) {
                setIsDeveloperAuthenticated(false);
                return;
            }

            if (data.branch1) {
                setBranch1((prev) => ({
                    ...prev,
                    name: data.branch1.name || "Branch 1 (Head Office)",
                    endpoint: data.branch1.endpoint || "",
                    serialNumber: data.branch1.serialNumber || "",
                    username: data.branch1.username || "api",
                    password: data.branch1.password || "",
                    status: data.branch1.status || "Unknown",
                    lastSync: data.branch1.lastSync ? new Date(data.branch1.lastSync).toLocaleString() : "Never"
                }));
            }
            if (data.branch2) {
                setBranch2((prev) => ({
                    ...prev,
                    name: data.branch2.name || "Branch 2 (Site Office)",
                    endpoint: data.branch2.endpoint || "",
                    serialNumber: data.branch2.serialNumber || "",
                    username: data.branch2.username || "api",
                    password: data.branch2.password || "",
                    status: data.branch2.status || "Not Configured",
                    lastSync: data.branch2.lastSync ? new Date(data.branch2.lastSync).toLocaleString() : "Never"
                }));
            }
        } catch (error) {
            notify({ tone: "error", title: "Error loading biometric configurations" });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(branchKey) {
        const isBranch1 = branchKey === "branch1";
        if (isBranch1) setSavingBranch1(true);
        else setSavingBranch2(true);

        const current = isBranch1 ? branch1 : branch2;
        try {
            const res = await fetch("/api/essl/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save_config",
                    branch: branchKey,
                    config: {
                        name: current.name,
                        endpoint: current.endpoint,
                        serialNumber: current.serialNumber,
                        username: current.username,
                        password: current.password
                    }
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to save configuration");
            notify({ tone: "success", title: `${current.name} configuration saved` });
            await loadConfig();
        } catch (error) {
            notify({ tone: "error", title: error.message || "Failed to save configuration" });
        } finally {
            if (isBranch1) setSavingBranch1(false);
            else setSavingBranch2(false);
        }
    }

    async function handleSync(targetBranch) {
        if (targetBranch === "branch1") setSyncingBranch1(true);
        else if (targetBranch === "branch2") setSyncingBranch2(true);
        else setSyncingAll(true);

        try {
            const res = await fetch("/api/essl/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sync",
                    branch: targetBranch
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Machine sync could not be completed.");
            const syncTime = new Date(data.lastSync).toLocaleString();
            notify({ tone: "success", title: "Biometric sync completed", description: `Last sync: ${syncTime}` });
            await loadConfig();
        } catch (error) {
            notify({ tone: "error", title: error.message || "Error syncing biometric data" });
        } finally {
            setSyncingBranch1(false);
            setSyncingBranch2(false);
            setSyncingAll(false);
        }
    }

    function renderStatusBadge(status) {
        if (status === "Connected") {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected
                </span>
            );
        }
        if (status === "Not Configured") {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Not Configured
                </span>
            );
        }
        if (status === "Checking...") {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                    Checking...
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {status}
            </span>
        );
    }

    // 1. Loading state while checking session
    if (isDeveloperAuthenticated === null) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-muted-foreground">Checking developer credentials...</p>
            </div>
        );
    }

    // 2. Security Gate if not authenticated
    if (!isDeveloperAuthenticated) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center p-4">
                <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-2xl shadow-blue-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 sm:p-9">
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white shadow-xl shadow-blue-500/25 ring-4 ring-blue-50 dark:ring-blue-950/80">
                            <KeyRound className="h-8 w-8" />
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
                            <ShieldAlert className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            Restricted Area · Developer Key Required
                        </span>
                        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                            Developer Security Gate
                        </h2>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            Biometric device SOAP endpoints, machine serial IDs, and sync credentials are encrypted and restricted. Enter developer key to unlock access.
                        </p>
                    </div>

                    <form onSubmit={handleDeveloperVerify} className="mt-6 space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Developer Master Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={developerPassword}
                                    onChange={(e) => {
                                        setDeveloperPassword(e.target.value);
                                        if (authError) setAuthError("");
                                    }}
                                    placeholder="Enter developer key..."
                                    required
                                    autoFocus
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 pr-11 text-sm font-medium transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:focus:bg-slate-800"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {authError && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    {authError}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={verifyingPassword || !developerPassword}
                            className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 font-bold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:from-blue-700 hover:to-indigo-700"
                        >
                            {verifyingPassword ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying Security Token...
                                </>
                            ) : (
                                <>
                                    <Unlock className="mr-2 h-4 w-4" />
                                    Unlock Biometric Configuration
                                </>
                            )}
                        </Button>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-white/5 dark:bg-slate-800/40">
                            <p className="text-[11px] text-muted-foreground">
                                Protected Infrastructure · <span className="font-semibold text-slate-800 dark:text-slate-200">Akash Yadav (Software Engineer)</span>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // 3. Authenticated view
    return (
        <div className="space-y-6">
            {/* Developer Banner */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/30 p-4 dark:from-emerald-950/40 dark:to-sky-950/40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                        <Unlock className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Developer Mode Active</h3>
                            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase">Authorized</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Authenticated session · Full root access to Branch 1 & Branch 2 biometric machine settings.
                        </p>
                    </div>
                </div>
                <Button variant="secondary" size="sm" onClick={handleLock} className="border-emerald-200 hover:bg-emerald-100/50 dark:border-emerald-900 dark:hover:bg-emerald-950">
                    <Lock className="h-3.5 w-3.5 mr-1.5 text-slate-600 dark:text-slate-300" />
                    Lock Configuration
                </Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeading
                    title="Biometric Machine API (Branch 1 & Branch 2)"
                    description="Configure separate biometric API machines for Branch 1 and Branch 2 to sync punches automatically."
                />
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadConfig} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh Status
                    </Button>
                    <Button onClick={() => handleSync("all")} disabled={syncingAll || loading}>
                        {syncingAll ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Sync Both Branches
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ── Branch 1 Configuration Card ──────────────────── */}
                <div className="rounded-2xl border border-blue-200/70 bg-white p-6 shadow-sm dark:bg-slate-900/50 dark:border-white/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-50">Branch 1 (Head Office)</h3>
                                    <p className="text-xs text-muted-foreground">Primary biometric device</p>
                                </div>
                            </div>
                            {renderStatusBadge(branch1.status)}
                        </div>

                        <div className="space-y-4">
                            <Field label="Branch Display Name">
                                <Input
                                    value={branch1.name}
                                    onChange={(e) => setBranch1({ ...branch1, name: e.target.value })}
                                    placeholder="Branch 1 (Head Office)"
                                />
                            </Field>
                            <Field label="Biometric API Endpoint URL (SOAP WebAPIService.asmx)">
                                <Input
                                    value={branch1.endpoint}
                                    onChange={(e) => setBranch1({ ...branch1, endpoint: e.target.value })}
                                    placeholder="https://your-domain.ngrok-free.dev/iclock/WebAPIService.asmx"
                                />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Machine Serial Number">
                                    <Input
                                        value={branch1.serialNumber}
                                        onChange={(e) => setBranch1({ ...branch1, serialNumber: e.target.value })}
                                        placeholder="e.g. NfZ8243803928"
                                    />
                                </Field>
                                <Field label="API Username">
                                    <Input
                                        value={branch1.username}
                                        onChange={(e) => setBranch1({ ...branch1, username: e.target.value })}
                                        placeholder="api"
                                    />
                                </Field>
                            </div>
                            <Field label="API Password">
                                <Input
                                    type="password"
                                    value={branch1.password}
                                    onChange={(e) => setBranch1({ ...branch1, password: e.target.value })}
                                    placeholder="Enter or update password"
                                />
                            </Field>
                            <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground dark:bg-slate-800/50 flex justify-between items-center">
                                <span>Last Synchronized:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{branch1.lastSync}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex gap-3">
                        <Button
                            onClick={() => handleSave("branch1")}
                            disabled={savingBranch1}
                            className="flex-1"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {savingBranch1 ? "Saving..." : "Save Branch 1"}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleSync("branch1")}
                            disabled={syncingBranch1}
                        >
                            {syncingBranch1 ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Sync Branch 1
                        </Button>
                    </div>
                </div>

                {/* ── Branch 2 Configuration Card ──────────────────── */}
                <div className="rounded-2xl border border-purple-200/70 bg-white p-6 shadow-sm dark:bg-slate-900/50 dark:border-white/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-100 dark:border-purple-900">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-50">Branch 2 (Site Office)</h3>
                                    <p className="text-xs text-muted-foreground">Secondary biometric device</p>
                                </div>
                            </div>
                            {renderStatusBadge(branch2.status)}
                        </div>

                        <div className="space-y-4">
                            <Field label="Branch Display Name">
                                <Input
                                    value={branch2.name}
                                    onChange={(e) => setBranch2({ ...branch2, name: e.target.value })}
                                    placeholder="Branch 2 (Site Office)"
                                />
                            </Field>
                            <Field label="Biometric API Endpoint URL (SOAP WebAPIService.asmx)">
                                <Input
                                    value={branch2.endpoint}
                                    onChange={(e) => setBranch2({ ...branch2, endpoint: e.target.value })}
                                    placeholder="https://branch2-domain.ngrok-free.dev/iclock/WebAPIService.asmx"
                                />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Machine Serial Number">
                                    <Input
                                        value={branch2.serialNumber}
                                        onChange={(e) => setBranch2({ ...branch2, serialNumber: e.target.value })}
                                        placeholder="e.g. SN2983472983"
                                    />
                                </Field>
                                <Field label="API Username">
                                    <Input
                                        value={branch2.username}
                                        onChange={(e) => setBranch2({ ...branch2, username: e.target.value })}
                                        placeholder="api"
                                    />
                                </Field>
                            </div>
                            <Field label="API Password">
                                <Input
                                    type="password"
                                    value={branch2.password}
                                    onChange={(e) => setBranch2({ ...branch2, password: e.target.value })}
                                    placeholder="Enter password for Branch 2"
                                />
                            </Field>
                            <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground dark:bg-slate-800/50 flex justify-between items-center">
                                <span>Last Synchronized:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{branch2.lastSync}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex gap-3">
                        <Button
                            onClick={() => handleSave("branch2")}
                            disabled={savingBranch2}
                            className="flex-1"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {savingBranch2 ? "Saving..." : "Save Branch 2"}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleSync("branch2")}
                            disabled={syncingBranch2}
                        >
                            {syncingBranch2 ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Sync Branch 2
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
