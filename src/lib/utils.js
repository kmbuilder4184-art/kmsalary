import { clsx } from "clsx";
export function cn(...inputs) {
    return clsx(inputs);
}
export function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
}
export function formatDate(value) {
    if (!value)
        return "Not recorded";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(value));
}
export function monthName(month) {
    return new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(2024, month - 1, 1));
}
export function initials(name) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}
export function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
