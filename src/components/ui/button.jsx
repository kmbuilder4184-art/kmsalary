import { cn } from "@/lib/utils";
export function Button({ className, variant = "primary", size = "md", type = "button", ...props }) {
    return (<button type={type} className={cn("inline-flex items-center justify-center gap-2 rounded-lg border font-medium shadow-sm whitespace-nowrap shrink-0 transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-55", variant === "primary" &&
            "border-primary bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20", variant === "secondary" &&
            "border-primary/20 bg-primary/10 text-primary hover:border-primary/35 hover:bg-primary/15 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-foreground dark:hover:bg-primary/25", variant === "ghost" &&
            "border-transparent bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/15", variant === "danger" &&
            "border-destructive bg-destructive text-white hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/20 focus:ring-destructive/30", size === "sm" && "h-9 px-3 text-sm", size === "md" && "h-10 px-4 text-sm", size === "icon" && "h-10 w-10 p-0", className)} {...props}/>);
}
