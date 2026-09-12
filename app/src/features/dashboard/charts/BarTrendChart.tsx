import type { ReactElement } from "react";

export interface BarTrendPoint {
    label: string;
    value: number;
    isCurrent?: boolean;
    tooltip?: string;
}

interface BarTrendChartProps {
    points: BarTrendPoint[];
    valueFormatter: (value: number) => string;
    emptyMessage: string;
    color?: string;
    height?: number;
}

export const BarTrendChart = ({
    points,
    valueFormatter,
    emptyMessage,
    color = "var(--accent)",
    height = 180,
}: BarTrendChartProps): ReactElement => {
    const hasData = points.some((p) => p.value > 0);
    if (points.length === 0 || !hasData) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const maxValue = Math.max(...points.map((p) => p.value), 1);
    const width = Math.max(points.length * 56, 280);
    const padBottom = 22;
    const chartHeight = height - padBottom;
    const barWidth = Math.min(32, (width / points.length) * 0.6);

    return (
        <div className="trend-chart">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
                {points.map((point, idx) => {
                    const slot = width / points.length;
                    const x = slot * idx + (slot - barWidth) / 2;
                    const barHeight = maxValue > 0 ? (point.value / maxValue) * (chartHeight - 8) : 0;
                    const y = chartHeight - barHeight;
                    return (
                        <g key={`${point.label}-${idx}`}>
                            <title>{point.tooltip ?? `${point.label}: ${valueFormatter(point.value)}`}</title>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
                                rx={4}
                                fill={color}
                                fillOpacity={point.isCurrent ? 1 : 0.55}
                                stroke={point.isCurrent ? color : "none"}
                                strokeWidth={point.isCurrent ? 2 : 0}
                            />
                            <text x={x + barWidth / 2} y={height - 6} fontSize="9.5" textAnchor="middle" fill="var(--muted)">
                                {point.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
