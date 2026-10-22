import { cn } from "@/lib/utils";
export function Badge({ children, tone = "neutral", className }) {
    return (<span className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/40 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10", tone === "neutral" && "text-muted-foreground", tone === "success" && "text-emerald-700 dark:text-emerald-300", tone === "danger" && "text-rose-700 dark:text-rose-300", tone === "warning" && "text-amber-700 dark:text-amber-300", tone === "info" && "text-cyan-700 dark:text-cyan-300", className)}>
      {children}
    </span>);
}
