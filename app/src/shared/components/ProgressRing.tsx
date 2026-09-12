import type { ReactElement } from "react";

interface ProgressRingProps {
    /** 0–100. Values above 100 are clamped so a completed goal shows a full ring. */
    percent: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    label?: string;
}

export const ProgressRing = ({
    percent,
    size = 64,
    strokeWidth = 6,
    color = "var(--accent)",
    label,
}: ProgressRingProps): ReactElement => {
    const clamped = Math.max(0, Math.min(100, percent));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;

    return (
        <div className="progress-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(clamped)}% complete`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: "stroke-dasharray 320ms ease" }}
                />
            </svg>
            <span className="progress-ring__value">{Math.round(clamped)}%</span>
        </div>
    );
};
