import type { ReactElement } from "react";

import { useTheme, type ThemePreference } from "../theme/ThemeContext";

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "☀" },
    { value: "dark", label: "Dark", icon: "☾" },
    { value: "system", label: "System", icon: "◐" },
];

export const ThemeToggle = (): ReactElement => {
    const { theme, setTheme } = useTheme();

    return (
        <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
            {OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={theme === option.value}
                    className={`theme-toggle__option${theme === option.value ? " is-active" : ""}`}
                    onClick={() => setTheme(option.value)}
                >
                    <span aria-hidden="true">{option.icon}</span>
                    {option.label}
                </button>
            ))}
        </div>
    );
};
