"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
export function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mode, setMode] = useState("login");
    const [otp, setOtp] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    async function submit(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        const response = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        setLoading(false);
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            setError(data?.message || "Unable to sign in.");
            return;
        }
        const sessionResponse = await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store"
        });
        if (!sessionResponse.ok) {
            setError([
                "Login successful, but browser did not save the session.",
                "Open the app with same laptop IP/port, for example http://192.168.x.x:3000."
            ].join(" "));
            return;
        }
        const nextParam = params.get("next");
        const targetUrl = (nextParam && nextParam !== "/" && nextParam !== "/login") ? nextParam : "/dashboard";
        window.location.href = targetUrl;
    }
    async function requestOtp(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        const response = await fetch("/api/auth/forgot-password/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        setLoading(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            setError(data?.message || "Unable to send OTP.");
            return;
        }
        setMode("verify");
    }
    async function verifyOtp(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        const response = await fetch("/api/auth/forgot-password/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        });
        setLoading(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            setError(data?.message || "OTP verification failed.");
            return;
        }
        setResetToken(data.resetToken);
        setMode("reset");
    }
    async function resetPassword(event) {
        event.preventDefault();
        setError("");
        if (newPassword !== confirmPassword) {
            setError("New password does not match.");
            return;
        }
        setLoading(true);
        const response = await fetch("/api/auth/forgot-password/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, resetToken, password: newPassword })
        });
        setLoading(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            setError(data?.message || "Unable to reset password.");
            return;
        }
        setPassword("");
        setOtp("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setMode("login");
    }
    if (mode === "forgot") {
        return (<form onSubmit={requestOtp} className="grid gap-4">
          <Field label={<span className="text-[13px] font-bold text-slate-700">Username</span>}>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"/>
              <Input 
                className="pl-10 h-[42px] bg-white border-blue-200/60 text-slate-800 font-medium rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-[14px]" 
                type="text" 
                value={email} 
                onChange={(event) => setEmail(event.target.value)} 
                autoComplete="username" 
                placeholder="Username"
                required
              />
            </div>
          </Field>
          {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 border border-rose-100">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full h-[42px] text-white font-bold text-[14px] rounded-xl transition-all hover:-translate-y-0.5 mt-1 flex items-center justify-center gap-2" style={{
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              boxShadow: '0 8px 20px -6px rgba(59,130,246,0.4)',
          }}>
            <Mail className="h-4 w-4"/>
            {loading ? "Sending OTP..." : "Send OTP"}
          </Button>
          <button type="button" className="text-[12px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors" onClick={() => setMode("login")}>Back to login</button>
        </form>);
    }
    if (mode === "verify") {
        return (<form onSubmit={verifyOtp} className="grid gap-4">
          <Field label="OTP">
            <Input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} required/>
          </Field>
          {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            <ShieldCheck className="h-4 w-4"/>
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setMode("forgot")}>Resend OTP</button>
        </form>);
    }
    if (mode === "reset") {
        return (<form onSubmit={resetPassword} className="grid gap-4">
          <Field label="New Password">
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required/>
          </Field>
          <Field label="Confirm New Password">
            <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required/>
          </Field>
          {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            <LockKeyhole className="h-4 w-4"/>
            {loading ? "Saving..." : "Create New Password"}
          </Button>
        </form>);
    }
    return (<form onSubmit={submit} className="grid gap-4">
      <Field label={<span className="text-[13px] font-bold text-slate-700">Username</span>}>
        <div className="relative mt-1.5">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"/>
          <Input 
            className="pl-10 h-[42px] bg-white border-blue-200/60 text-slate-800 font-medium rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-[14px]" 
            type="text" 
            value={email} 
            onChange={(event) => setEmail(event.target.value)} 
            autoComplete="username" 
            placeholder="Username"
            required
          />
        </div>
      </Field>
      
      <Field label={<span className="text-[13px] font-bold text-slate-700">Password</span>}>
        <div className="relative mt-1.5">
          <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"/>
          <Input 
            className="pl-10 pr-10 h-[42px] bg-white border-blue-200/60 text-slate-800 font-medium rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-[14px]" 
            type={showPassword ? "text" : "password"} 
            value={password} 
            onChange={(event) => setPassword(event.target.value)} 
            autoComplete="current-password" 
            placeholder="•••••••••"
            required
          />
          <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-[18px] w-[18px]"/> : <Eye className="h-[18px] w-[18px]"/>}
          </button>
        </div>
      </Field>

      <div className="flex items-center justify-between mt-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative flex items-center justify-center w-4 h-4 rounded border border-blue-500 bg-blue-500 text-white">
             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">Remember me</span>
        </label>
        
        <button type="button" className="text-[12px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors" onClick={() => {
            setError("");
            setMode("forgot");
        }}>Forgot Password?</button>
      </div>

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 border border-rose-100">{error}</p> : null}
      
      <Button type="submit" disabled={loading} className="w-full h-[42px] text-white font-bold text-[14px] rounded-xl transition-all hover:-translate-y-0.5 mt-1 flex items-center justify-center gap-2" style={{
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          boxShadow: '0 8px 20px -6px rgba(59,130,246,0.4)',
      }}>
        {loading ? "Signing in..." : "Sign In →"}
      </Button>

      <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col items-center justify-center gap-1.5 text-center">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Protected by secure authentication</span>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              KM Builders • HR Management System
          </p>
      </div>
    </form>);
}
