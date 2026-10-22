"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, PartyPopper, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts((current) => current.filter((item) => item.id !== id));
    }, []);

    const notify = useCallback((toast) => {
        const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(2);
        const durationMs = toast.durationMs ?? (toast.tone === "success" ? 5200 : 5000);
        setToasts((current) => [...current.slice(-2), { ...toast, id, durationMs }]);
        window.setTimeout(() => dismiss(id), durationMs);
        return id;
    }, [dismiss]);

    const value = useMemo(() => ({ notify }), [notify]);
    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed left-1/2 top-[4.75rem] z-[70] flex w-[calc(100vw-2rem)] max-w-[26rem] -translate-x-1/2 flex-col gap-3 sm:left-auto sm:right-6 sm:top-20 sm:translate-x-0" aria-live="polite" aria-relevant="additions">
                {toasts.map((toast) => {
                    const isSuccess = toast.tone === "success";
                    const isError = toast.tone === "error";
                    const Icon = isSuccess ? CheckCircle2 : isError ? XCircle : Info;
                    const toneClass = isSuccess
                        ? "border-emerald-200 bg-white/95 text-slate-950 shadow-emerald-950/10 dark:border-emerald-800 dark:bg-slate-950/95 dark:text-white"
                        : isError
                            ? "border-rose-200 bg-white/95 text-slate-950 shadow-rose-950/10 dark:border-rose-800 dark:bg-slate-950/95 dark:text-white"
                            : "border-sky-200 bg-white/95 text-slate-950 shadow-sky-950/10 dark:border-sky-800 dark:bg-slate-950/95 dark:text-white";
                    const iconClass = isSuccess
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800"
                        : isError
                            ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800"
                            : "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800";

                    return (
                        <div
                            key={toast.id}
                            role={isError ? "alert" : "status"}
                            className={`toast-pop-in pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:px-5 ${toneClass}`}
                        >
                            <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconClass}`}>
                                <Icon className="h-7 w-7" strokeWidth={2.4} />
                                {isSuccess && <PartyPopper className="absolute -right-1.5 -top-1.5 h-5 w-5 -rotate-12 text-amber-500 drop-shadow-sm" aria-hidden="true" />}
                            </div>
                            <div className="min-w-0 flex-1 py-0.5">
                                <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${isSuccess ? "text-emerald-700 dark:text-emerald-300" : isError ? "text-rose-700 dark:text-rose-300" : "text-sky-700 dark:text-sky-300"}`}>
                                    {isSuccess ? "Success" : isError ? "Needs attention" : "Update"}
                                </p>
                                <p className="mt-0.5 break-words text-sm font-bold leading-5 sm:text-[15px]">{toast.title}</p>
                                {toast.description ? <p className="mt-0.5 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">{toast.description}</p> : null}
                            </div>
                            <button
                                type="button"
                                onClick={() => dismiss(toast.id)}
                                className="-mr-1 -mt-5 inline-flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Dismiss notification"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <div className={`toast-progress-fill absolute inset-x-0 bottom-0 h-1 ${isSuccess ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600" : isError ? "bg-rose-500" : "bg-sky-500"}`} style={{ "--toast-duration": `${toast.durationMs}ms` }} />
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within ToastProvider.");
    return context;
}
