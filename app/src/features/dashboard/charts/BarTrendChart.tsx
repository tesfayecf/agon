import type { ReactElement } from "react";

import { useElementWidth } from "../../../shared/hooks/useElementWidth";
import { pickVisibleLabelIndices } from "./chart-layout";

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
    ariaLabel?: string;
}

// The SVG viewBox is set to the real measured container width (via
// useElementWidth), so 1 viewBox unit == 1 real CSS pixel and text renders at
// its literal font-size everywhere — no uniform scale-down that shrinks a
// 10px label to 4px on a phone-width card.
const HEIGHT = 200;
const PAD_LEFT = 40;
const PAD_RIGHT = 10;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;
const MIN_LABEL_SLOT = 34;

const niceCeiling = (value: number): number => {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
};

export const BarTrendChart = ({
    points,
    valueFormatter,
    emptyMessage,
    color = "var(--chart-1)",
    ariaLabel = "Training volume by period",
}: BarTrendChartProps): ReactElement => {
    const { ref, width } = useElementWidth<HTMLDivElement>();

    const hasData = points.some((p) => p.value > 0);
    if (points.length === 0 || !hasData) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const viewW = Math.max(width, 260);
    const maxValue = niceCeiling(Math.max(...points.map((p) => p.value)));
    const plotW = viewW - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const slot = plotW / points.length;
    const barWidth = Math.min(30, slot * 0.52);
    const gridLines = [0, 0.5, 1];
    const visibleLabels = pickVisibleLabelIndices(points.length, plotW, MIN_LABEL_SLOT);

    return (
        <div className="trend-chart" ref={ref}>
            <svg viewBox={`0 0 ${viewW} ${HEIGHT}`} className="trend-chart__svg" style={{ height: HEIGHT }} role="img" aria-label={ariaLabel}>
                {gridLines.map((ratio) => {
                    const y = PAD_TOP + plotH * ratio;
                    return (
                        <g key={ratio}>
                            <line x1={PAD_LEFT} y1={y} x2={viewW - PAD_RIGHT} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 4" />
                            <text x={PAD_LEFT - 8} y={y + 3.5} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                                {valueFormatter(Math.round(maxValue * (1 - ratio) * 10) / 10)}
                            </text>
                        </g>
                    );
                })}

                {points.map((point, idx) => {
                    const x = PAD_LEFT + slot * idx + (slot - barWidth) / 2;
                    const barHeight = (point.value / maxValue) * plotH;
                    const y = PAD_TOP + plotH - barHeight;
                    return (
                        <g key={`${point.label}-${idx}`}>
                            <title>{point.tooltip ?? `${point.label}: ${valueFormatter(point.value)}`}</title>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
                                rx={3}
                                fill={color}
                                fillOpacity={point.isCurrent ? 1 : 0.42}
                            />
                            {point.isCurrent && point.value > 0 && (
                                <text x={x + barWidth / 2} y={y - 5} fontSize="10" fontWeight="650" fill={color} textAnchor="middle">
                                    {valueFormatter(point.value)}
                                </text>
                            )}
                            {visibleLabels.has(idx) && (
                                <text
                                    x={x + barWidth / 2}
                                    y={HEIGHT - 8}
                                    fontSize="10"
                                    fill={point.isCurrent ? "var(--ink-secondary)" : "var(--chart-axis-text)"}
                                    fontWeight={point.isCurrent ? 650 : 400}
                                    textAnchor="middle"
                                >
                                    {point.label}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
