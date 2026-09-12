import type { ReactElement, ReactNode } from "react";

export type TrendDirection = "up" | "down" | "flat";

export interface MetricTrend {
    direction: TrendDirection;
    label: string;
    /** When true, a downward move is the good outcome (e.g. pace, resting heart rate). */
    lowerIsBetter?: boolean;
}

interface MetricCardProps {
    label: string;
    value: string;
    /** Short qualifier shown under the value, e.g. "across 4 sessions". */
    hint?: string;
    icon?: ReactNode;
    trend?: MetricTrend;
    isAvailable?: boolean;
}

const TREND_GLYPH: Record<TrendDirection, string> = { up: "▲", down: "▼", flat: "—" };

const toneFor = ({ direction, lowerIsBetter = false }: MetricTrend): string => {
    if (direction === "flat") return "flat";
    const isGood = lowerIsBetter ? direction === "down" : direction === "up";
    return isGood ? "positive" : "negative";
};

export const MetricCard = ({ label, value, hint, icon, trend, isAvailable = true }: MetricCardProps): ReactElement => {
    return (
        <article className="metric-card">
            <div className="metric-card__top">
                <span className="metric-card__label">{label}</span>
                {icon !== undefined && (
                    <span className="metric-card__icon" aria-hidden="true">
                        {icon}
                    </span>
                )}
            </div>
            <p className={`metric-card__value${isAvailable ? "" : " metric-card__value--muted"}`}>{value}</p>
            <div className="metric-card__footer">
                {trend !== undefined && (
                    <span className={`metric-trend metric-trend--${toneFor(trend)}`}>
                        <span aria-hidden="true">{TREND_GLYPH[trend.direction]}</span>
                        {trend.label}
                    </span>
                )}
                {hint !== undefined && <span className="metric-card__hint">{hint}</span>}
            </div>
        </article>
    );
};
