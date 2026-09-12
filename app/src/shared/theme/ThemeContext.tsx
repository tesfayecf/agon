import { createContext, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "agon-theme";

interface ThemeContextValue {
    theme: ThemePreference;
    setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readStoredTheme = (): ThemePreference => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {
        // localStorage can throw in private browsing / disabled storage; fall back silently.
    }
    return "system";
};

const applyTheme = (theme: ThemePreference): void => {
    const root = document.documentElement;
    if (theme === "system") {
        root.removeAttribute("data-theme");
    } else {
        root.setAttribute("data-theme", theme);
    }
};

export const ThemeProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());

    useEffect(() => {
        applyTheme(theme);
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Best-effort persistence only; the app still works within this session.
        }
    }, [theme]);

    const setTheme = (next: ThemePreference): void => setThemeState(next);

    const value = useMemo(() => ({ theme, setTheme }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
    const ctx = useContext(ThemeContext);
    if (ctx === null) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return ctx;
};
