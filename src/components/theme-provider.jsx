"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
const ThemeContext = createContext(null);
const THEME_KEY = "sbi-theme";
const THEME_EVENT = "sbi-theme-change";
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState("light");
    useEffect(() => {
        const syncTheme = () => {
            const nextTheme = getStoredTheme();
            applyTheme(nextTheme);
            setTheme(nextTheme);
        };
        syncTheme();
        window.addEventListener("storage", syncTheme);
        window.addEventListener(THEME_EVENT, syncTheme);
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", syncTheme);
        return () => {
            window.removeEventListener("storage", syncTheme);
            window.removeEventListener(THEME_EVENT, syncTheme);
            media.removeEventListener("change", syncTheme);
        };
    }, []);
    const value = useMemo(() => ({
        theme,
        setTheme: setStoredTheme,
        toggleTheme: () => setStoredTheme(theme === "dark" ? "light" : "dark")
    }), [theme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context)
        throw new Error("useTheme must be used within ThemeProvider.");
    return context;
}
function getStoredTheme() {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark")
        return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function setStoredTheme(theme) {
    window.localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new Event(THEME_EVENT));
}
function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
}
