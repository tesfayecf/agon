import type { ReactElement } from "react";

export interface ScatterTrendPoint {
    x: number;
    y: number;
    tooltip?: string;
}

interface ScatterTrendChartProps {
    points: ScatterTrendPoint[];
    xFormatter: (value: number) => string;
    yFormatter: (value: number) => string;
    xLabel: string;
    yLabel: string;
    emptyMessage: string;
    color?: string;
    height?: number;
}

/**
 * A scatter chart where point opacity increases from oldest (faint) to newest (solid),
 * so the reader can see whether recent efforts sit at a better pace/heart-rate
 * combination than older ones without needing a legend.
 */
export const ScatterTrendChart = ({
    points,
    xFormatter,
    yFormatter,
    xLabel,
    yLabel,
    emptyMessage,
    color = "var(--chart-5)",
    height = 240,
}: ScatterTrendChartProps): ReactElement => {
    if (points.length < 2) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const rangeX = maxX - minX === 0 ? 1 : maxX - minX;
    const rangeY = maxY - minY === 0 ? 1 : maxY - minY;

    const width = 480;
    const padX = 46;
    const padY = 24;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;
    // Pad the value ranges by 10% so points never sit exactly on the chart edge.
    const marginX = rangeX * 0.1;
    const marginY = rangeY * 0.1;

    const toPx = (p: ScatterTrendPoint): { cx: number; cy: number } => ({
        cx: padX + ((p.x - minX + marginX) / (rangeX + marginX * 2)) * chartW,
        cy: height - padY - ((p.y - minY + marginY) / (rangeY + marginY * 2)) * chartH,
    });

    return (
        <div className="trend-chart">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
                {[0, 0.5, 1].map((ratio) => {
                    const y = padY + chartH * ratio;
                    return <line key={ratio} x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--chart-grid)" strokeDasharray="3 3" />;
                })}
                <text x={padX} y={height - 4} fontSize="9.5" fill="var(--chart-axis-text)" textAnchor="start">
                    {xLabel} →
                </text>
                <text x={padX - 36} y={padY - 8} fontSize="9.5" fill="var(--chart-axis-text)" textAnchor="start">
                    ↑ {yLabel}
                </text>

                {points.map((p, idx) => {
                    const { cx, cy } = toPx(p);
                    const opacity = 0.3 + (idx / (points.length - 1)) * 0.7;
                    const isLast = idx === points.length - 1;
                    return (
                        <g key={idx}>
                            <title>{p.tooltip ?? `${xFormatter(p.x)} · ${yFormatter(p.y)}`}</title>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={isLast ? 6 : 4.5}
                                fill={color}
                                fillOpacity={opacity}
                                stroke={isLast ? color : "none"}
                                strokeWidth={isLast ? 2 : 0}
                            />
                        </g>
                    );
                })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "0.76rem", color: "var(--muted)" }}>
                <span>○ older</span>
                <span>● most recent</span>
            </div>
        </div>
    );
};
