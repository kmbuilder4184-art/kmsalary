import { cn } from "@/lib/utils";
export function Card({ className, children }) {
    return (<section className={cn("glass-card rounded-xl text-card-foreground", className)}>
      {children}
    </section>);
}
export function CardHeader({ title, description, action }) {
    return (<div className="flex flex-col gap-3 border-b border-white/45 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>);
}
export function EmptyState({ title, description, action }) {
    return (<div className="grid place-items-center px-6 py-14 text-center">
      <div className="max-w-sm">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>);
}
