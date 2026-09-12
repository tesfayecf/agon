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
}

const VIEW_W = 760;
const VIEW_H = 280;
// Wide enough for the y tick labels to clear the rotated axis title on the far left.
const PAD_LEFT = 82;
const PAD_RIGHT = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 42;

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
    const marginX = rangeX * 0.08;
    const marginY = rangeY * 0.12;
    const domainX = rangeX + marginX * 2;
    const domainY = rangeY + marginY * 2;

    const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
    const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;

    const toPx = (p: ScatterTrendPoint): { cx: number; cy: number } => ({
        cx: PAD_LEFT + ((p.x - minX + marginX) / domainX) * plotW,
        cy: PAD_TOP + plotH - ((p.y - minY + marginY) / domainY) * plotH,
    });

    const yTicks = [0, 0.5, 1];
    const xTicks = [0, 0.5, 1];

    return (
        <div className="trend-chart">
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="trend-chart__svg" role="img" aria-label={`${yLabel} against ${xLabel}`}>
                {yTicks.map((ratio) => {
                    const y = PAD_TOP + plotH * ratio;
                    const value = maxY + marginY - ratio * domainY;
                    return (
                        <g key={`y-${ratio}`}>
                            <line x1={PAD_LEFT} y1={y} x2={VIEW_W - PAD_RIGHT} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 4" />
                            <text x={PAD_LEFT - 10} y={y + 3.5} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                                {yFormatter(value)}
                            </text>
                        </g>
                    );
                })}

                {xTicks.map((ratio) => {
                    const x = PAD_LEFT + plotW * ratio;
                    const value = minX - marginX + ratio * domainX;
                    return (
                        <text
                            key={`x-${ratio}`}
                            x={x}
                            y={PAD_TOP + plotH + 18}
                            fontSize="10"
                            fill="var(--chart-axis-text)"
                            textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"}
                        >
                            {xFormatter(value)}
                        </text>
                    );
                })}

                <text x={PAD_LEFT} y={VIEW_H - 8} fontSize="10" fontWeight="650" fill="var(--muted)" textAnchor="start">
                    {xLabel} →
                </text>
                <text x={VIEW_W - PAD_RIGHT} y={VIEW_H - 8} fontSize="10" fill="var(--muted)" textAnchor="end">
                    faint = older · solid = most recent
                </text>
                <text
                    x={14}
                    y={PAD_TOP + plotH / 2}
                    fontSize="10"
                    fontWeight="650"
                    fill="var(--muted)"
                    textAnchor="middle"
                    transform={`rotate(-90 14 ${PAD_TOP + plotH / 2})`}
                >
                    {yLabel}
                </text>

                {points.map((p, idx) => {
                    const { cx, cy } = toPx(p);
                    const opacity = 0.22 + (idx / (points.length - 1)) * 0.78;
                    const isLast = idx === points.length - 1;
                    return (
                        <g key={idx}>
                            <title>{p.tooltip ?? `${xFormatter(p.x)} · ${yFormatter(p.y)}`}</title>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={isLast ? 6 : 4}
                                fill={color}
                                fillOpacity={opacity}
                                stroke={isLast ? "var(--surface)" : "none"}
                                strokeWidth={isLast ? 2 : 0}
                            />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
