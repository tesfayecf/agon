import type { ReactElement } from "react";

export interface LineTrendPoint {
    label: string;
    value: number;
    tooltip?: string;
}

interface LineTrendChartProps {
    points: LineTrendPoint[];
    valueFormatter: (value: number) => string;
    emptyMessage: string;
    color?: string;
    height?: number;
}

export const LineTrendChart = ({
    points,
    valueFormatter,
    emptyMessage,
    color = "var(--accent)",
    height = 180,
}: LineTrendChartProps): ReactElement => {
    if (points.length === 0) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const values = points.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const width = Math.max(points.length * 70, 280);
    const padX = 12;
    const padY = 16;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const coords = points.map((p, idx) => ({
        ...p,
        x: padX + (points.length > 1 ? (idx / (points.length - 1)) * chartW : chartW / 2),
        y: padY + chartH - ((p.value - minVal) / range) * chartH,
    }));

    const pathData = coords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");

    return (
        <div className="trend-chart">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
                <path d={pathData} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {coords.map((pt, idx) => (
                    <g key={`${pt.label}-${idx}`}>
                        <title>{pt.tooltip ?? `${pt.label}: ${valueFormatter(pt.value)}`}</title>
                        <circle cx={pt.x} cy={pt.y} r={4} fill={color} />
                        <text x={pt.x} y={height - 2} fontSize="9.5" textAnchor="middle" fill="var(--muted)">
                            {pt.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};
