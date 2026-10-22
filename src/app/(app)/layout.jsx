import { AppShell } from "@/components/app-shell";
export default function ProtectedLayout({ children }) {
    return <AppShell>{children}</AppShell>;
}
