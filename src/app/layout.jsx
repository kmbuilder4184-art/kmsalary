import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("sbi-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();
`;
export const metadata = {
    title: "KM Builders - Employee Salary Management",
    description: "Employee salary management system for KM Builders.",
    icons: {
        icon: "/km-builders-logo.png",
        shortcut: "/km-builders-logo.png",
        apple: "/km-builders-logo.png"
    }
};
export default function RootLayout({ children }) {
    return (<html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }}/>
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>);
}
