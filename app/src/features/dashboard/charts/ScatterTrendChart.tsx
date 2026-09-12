import type { ReactElement } from "react";

import { useElementWidth } from "../../../shared/hooks/useElementWidth";

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

const HEIGHT = 260;
const PAD_RIGHT = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 40;

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
    const { ref, width } = useElementWidth<HTMLDivElement>();

    if (points.length < 2) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const viewW = Math.max(width, 260);
    // Narrow viewports drop the rotated y-axis title (kept as an aria-label instead)
    // and use a tighter left gutter, since there's no room for both a title and ticks.
    const compact = viewW < 420;
    const padLeft = compact ? 46 : 82;

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

    const plotW = viewW - padLeft - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const toPx = (p: ScatterTrendPoint): { cx: number; cy: number } => ({
        cx: padLeft + ((p.x - minX + marginX) / domainX) * plotW,
        cy: PAD_TOP + plotH - ((p.y - minY + marginY) / domainY) * plotH,
    });

    const yTicks = [0, 0.5, 1];
    const xTicks = [0, 0.5, 1];

    return (
        <div className="trend-chart" ref={ref}>
            <svg
                viewBox={`0 0 ${viewW} ${HEIGHT}`}
                className="trend-chart__svg"
                style={{ height: HEIGHT }}
                role="img"
                aria-label={`${yLabel} (vertical) against ${xLabel} (horizontal); each point one training, opacity increasing from oldest to most recent`}
            >
                {yTicks.map((ratio) => {
                    const y = PAD_TOP + plotH * ratio;
                    const value = maxY + marginY - ratio * domainY;
                    return (
                        <g key={`y-${ratio}`}>
                            <line x1={padLeft} y1={y} x2={viewW - PAD_RIGHT} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 4" />
                            <text x={padLeft - 8} y={y + 3.5} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                                {yFormatter(value)}
                            </text>
                        </g>
                    );
                })}

                {xTicks.map((ratio) => {
                    const x = padLeft + plotW * ratio;
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

                <text x={padLeft} y={HEIGHT - 8} fontSize="10" fontWeight="650" fill="var(--muted)" textAnchor="start">
                    {xLabel} →
                </text>
                {!compact && (
                    <text x={viewW - PAD_RIGHT} y={HEIGHT - 8} fontSize="10" fill="var(--muted)" textAnchor="end">
                        faint = older · solid = most recent
                    </text>
                )}
                {!compact && (
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
                )}

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
