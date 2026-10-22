"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenText, Building2, Calculator, ChevronLeft, ChevronRight, FileText, Linkedin, LayoutDashboard, LogOut, Mail, Menu, Moon, ReceiptText, Settings, Sun, Users, Server, ClipboardList, GraduationCap, BookOpenCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
    { href: "/employees", label: "Employees", icon: Users, permission: "employees.view" },
    { href: "/essl-salary", label: "Biometric Salary Calculator", icon: Calculator, permission: "salary.view" },
    { href: "/essl-salary-report", label: "Biometric Salary Report", icon: BarChart3, permission: "salary.view" },
    { href: "/ledger", label: "Expense Entry", icon: BookOpenText, permission: "ledger.view" },
    { href: "/essl-report", label: "Biometric Attendance Report", icon: ClipboardList, adminOnly: true },
    { href: "/essl", label: "Biometric Device Config", icon: Server, adminOnly: true },
    { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
    { href: "/settings", label: "Settings", icon: Settings, adminOnly: true }
];

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 380;
const SIDEBAR_DEFAULT = 280;
const SIDEBAR_STEP = 20;

export function AppShell({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const sidebarWidth = isCollapsed ? 80 : 280;

    useEffect(() => {
        fetch("/api/auth/me")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setUser(data?.user || null))
            .catch(() => setUser(null));
    }, []);

    useEffect(() => {
        if (!user)
            return;
        const currentItem = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
        if (!currentItem)
            return;
        const allowed = currentItem.adminOnly ? user.role === "Admin" : can(currentItem.permission);
        if (allowed)
            return;
        const fallback = navItems.find((item) => !item.adminOnly && can(item.permission));
        router.replace(fallback?.href || "/login");
    }, [pathname, router, user]);

    async function logout() {
        try {
            const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
            if (!response.ok) throw new Error("Logout request failed");
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            setUser(null);
            router.replace("/login");
            router.refresh();
        }
    }

    function toggleSidebar() {
        setIsCollapsed(!isCollapsed);
    }

    function can(permission) {
        return user?.role === "Admin" || user?.permissions?.includes(permission);
    }

    const sidebar = (<aside className="glass-sidebar flex h-full flex-col border-r border-white/55 transition-all duration-300 ease-in-out dark:border-white/10">
      <div className={cn("flex h-20 shrink-0 items-center border-b border-white/45 dark:border-white/10 transition-all duration-300", isCollapsed ? "justify-center px-0" : "gap-3 px-5")}>
        <div className="h-11 w-11 rounded-xl bg-white p-1 shadow-md shrink-0 border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden">
          <img src="/km-builders-logo.png" alt="KM Builders Logo" className="h-full w-full object-contain" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 animate-fade-in-up">
            <p className="school-name-gradient truncate text-sm font-extrabold tracking-wide">KM BUILDERS</p>
            <p className="truncate text-xs font-medium text-muted-foreground">Property Developers</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar grid content-start gap-1 p-3">
        {navItems.filter((item) => {
            if (item.adminOnly)
                return user?.role === "Admin";
            return can(item.permission);
        }).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (<Link href={item.href} key={item.href} onClick={() => setMobileOpen(false)} title={isCollapsed ? item.label : undefined} className={cn("flex h-11 items-center rounded-xl text-sm font-semibold transition-all duration-300", active
                    ? "bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-50",
                    isCollapsed ? "justify-center px-0 w-11 mx-auto" : "gap-3 px-3 w-full")}>
              <Icon className="h-5 w-5 shrink-0"/>
              {!isCollapsed && <span className="truncate flex-1 min-w-0">{item.label}</span>}
            </Link>);
        })}
      </nav>

      {/* ── Sidebar Toggle Controls ──────────────────── */}
      <div className="flex shrink-0 items-center justify-center p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="group relative flex h-10 w-full items-center justify-center rounded-xl border border-slate-200/60 bg-white/50 text-slate-600 shadow-sm transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
          aria-label="Toggle sidebar"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 transition-transform group-hover:scale-110" />
          ) : (
            <>
              <ChevronLeft className="absolute left-3 h-5 w-5 transition-transform group-hover:-translate-x-1" />
              <span className="text-xs font-bold uppercase tracking-wider">Collapse</span>
            </>
          )}
        </button>
      </div>

      <div className={cn("mt-auto shrink-0 border-t border-white/45 dark:border-white/10 transition-all duration-300", isCollapsed ? "p-3" : "p-4")}>
        {!isCollapsed && (
          <div className="mb-3 rounded-xl border border-slate-200/60 bg-white/60 p-3 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-800/60">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{user?.name || "Signed in"}</p>
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{user?.role || "Account"}</p>
          </div>
        )}
        <Button variant="destructive" className={cn("transition-all duration-300", isCollapsed ? "h-11 w-11 p-0 mx-auto flex items-center justify-center rounded-xl" : "w-full justify-start rounded-xl")} onClick={logout} title={isCollapsed ? "Sign out" : undefined}>
          <LogOut className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4 mr-2")}/>
          {!isCollapsed && "Sign out"}
        </Button>
      </div>
    </aside>);
    return (<ToastProvider>
      <div className="min-h-screen lg:grid transition-all duration-300 ease-in-out" style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}>
        <div className="fixed inset-y-0 left-0 z-40 hidden lg:block transition-all duration-300 ease-in-out" style={{ width: `${sidebarWidth}px` }}>{sidebar}</div>

        {mobileOpen ? (<div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>
            <div className="relative h-full w-[280px] transition-all duration-300 ease-in-out">{sidebar}</div>
          </div>) : null}

        <main className="lg:col-start-2 min-w-0 overflow-hidden">
          <header className="glass-topbar sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-white/55 px-3 sm:px-6 dark:border-white/10">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5"/>
              </Button>
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <img src="/km-builders-logo.png" alt="KM Builders logo" className="brand-logo h-9 w-9 shrink-0 sm:h-10 sm:w-10"/>
                <div className="min-w-0">
                  <p className="school-name-gradient truncate text-[13px] leading-tight sm:text-base">KM Builders</p>
                  <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                    <Building2 className="h-3.5 w-3.5 shrink-0"/>
                    <span className="truncate">Property Developers</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
              </Button>
              {can("salary.view") ? (<Link href="/essl-salary-report" className="hidden sm:inline-flex">
                <Button variant="secondary">
                  <FileText className="h-4 w-4"/>
                  Salary Report
                </Button>
              </Link>) : null}
            </div>
          </header>
          <div className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <div key={pathname} className="animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
              {children}
            </div>
          </div>
          <AppFooter />
        </main>
      </div>
    </ToastProvider>);
}

function AppFooter() {
    return (<footer className="mx-4 mb-6 mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950 dark:text-slate-100 dark:shadow-slate-950/20 sm:mx-6 lg:mx-8">
      <div className="h-px bg-gradient-to-r from-transparent via-sky-500 to-transparent"/>
      <div className="grid gap-8 px-5 py-7 sm:px-7 xl:grid-cols-[minmax(260px,1fr)_minmax(300px,1.15fr)_minmax(210px,0.8fr)] lg:px-8">
        <div className="flex min-w-0 items-start gap-4">
          <img src="/bizedify-logo.png" alt="BizEdify logo" className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 bg-white p-1.5 object-contain shadow-lg dark:border-white/10"/>
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-wide text-slate-950 dark:text-white">BizEdify</p>
            <p className="mt-2 max-w-[220px] text-sm leading-6 text-slate-600 dark:text-slate-400">Smart Salary Management Solution</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 text-sm">
          <p className="font-semibold text-slate-950 dark:text-white">Developed By: AKASH YADAV</p>
          <p className="text-slate-600 dark:text-slate-400">Software Engineer</p>
          <a href="https://www.linkedin.com/in/akash288" target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">
            <Linkedin className="h-4 w-4 shrink-0"/>
            <span className="truncate">linkedin.com/in/akash288</span>
          </a>
          <a href="mailto:yakash4184@gmail.com" className="inline-flex min-w-0 items-center gap-2 text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">
            <Mail className="h-4 w-4 shrink-0"/>
            <span className="truncate">yakash4184@gmail.com</span>
          </a>
        </div>

        <div className="grid gap-4 text-sm xl:justify-items-end xl:text-right">
          <p className="text-slate-600 dark:text-slate-400">© 2026 BizEdify. All rights reserved.</p>
          <nav className="flex flex-wrap gap-3 xl:justify-end">
            <Link href="/dashboard" className="text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">Dashboard</Link>
            <Link href="/employees" className="text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">Employees</Link>
            <Link href="/essl-salary-report" className="text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">Salary Report</Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 sm:px-7 lg:px-8">
        <div className="flex max-w-full flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center shadow-lg shadow-slate-200/40 transition duration-300 hover:-translate-y-1 hover:border-sky-300/70 hover:shadow-sky-200/70 dark:border-white/10 dark:bg-white/10 dark:shadow-sky-950/20 dark:hover:border-sky-300/60 dark:hover:shadow-sky-500/20 sm:mx-auto sm:w-fit sm:min-w-[420px] sm:flex-row sm:justify-start sm:text-left">
          <img src="/akash-yadav-profile.png" alt="Akash Yadav" className="h-20 w-20 shrink-0 rounded-full border-4 border-white object-cover object-[58%_25%] shadow-lg ring-2 ring-sky-300/70 transition duration-300 hover:scale-105 dark:border-slate-900 dark:shadow-sky-500/20"/>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-2xl font-semibold leading-tight text-slate-950 dark:text-white">Akash Yadav</p>
            <p className="mt-1 whitespace-nowrap text-base text-slate-600 dark:text-slate-400">Software Engineer</p>
          </div>
        </div>
      </div>
    </footer>);
}
