import type { ReactElement } from "react";

interface MetricCardProps {
    label: string;
    value: string;
    isAvailable?: boolean;
}

export const MetricCard = ({ label, value, isAvailable = true }: MetricCardProps): ReactElement => {
    return (
        <article className="metric-card">
            <span className="metric-card__label">{label}</span>
            <p className={`metric-card__value ${isAvailable ? "" : "metric-card__value--muted"}`}>{value}</p>
        </article>
    );
};
