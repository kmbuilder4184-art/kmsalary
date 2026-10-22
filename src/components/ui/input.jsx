import { cn } from "@/lib/utils";
const controlClass = "w-full rounded-lg border border-white/55 bg-white/58 px-3 py-2 text-sm text-foreground shadow-sm outline-none backdrop-blur-xl transition placeholder:text-muted-foreground focus:border-primary/70 focus:bg-white/75 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:focus:bg-white/15";
export function Input({ className, ...props }) {
    return <input className={cn(controlClass, className)} {...props}/>;
}
export function Select({ className, ...props }) {
    return <select className={cn(controlClass, "h-10", className)} {...props}/>;
}
export function Textarea({ className, ...props }) {
    return <textarea className={cn(controlClass, "min-h-24 resize-y", className)} {...props}/>;
}
export function Field({ label, hint, children }) {
    return (<label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>);
}
