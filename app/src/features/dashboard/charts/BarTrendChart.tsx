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
}

// A fixed viewBox keeps the rendered aspect ratio stable (and short) no matter how wide
// the card is, instead of growing taller as the container grows.
const VIEW_W = 760;
const VIEW_H = 230;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;

const niceCeiling = (value: number): number => {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
};

export const BarTrendChart = ({ points, valueFormatter, emptyMessage, color = "var(--chart-1)" }: BarTrendChartProps): ReactElement => {
    const hasData = points.some((p) => p.value > 0);
    if (points.length === 0 || !hasData) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const maxValue = niceCeiling(Math.max(...points.map((p) => p.value)));
    const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
    const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
    const slot = plotW / points.length;
    const barWidth = Math.min(30, slot * 0.52);
    const gridLines = [0, 0.5, 1];

    return (
        <div className="trend-chart">
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="trend-chart__svg" role="img" aria-label="Training volume by period">
                {gridLines.map((ratio) => {
                    const y = PAD_TOP + plotH * ratio;
                    return (
                        <g key={ratio}>
                            <line x1={PAD_LEFT} y1={y} x2={VIEW_W - PAD_RIGHT} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 4" />
                            <text x={PAD_LEFT - 10} y={y + 3.5} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
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
                                <text
                                    x={x + barWidth / 2}
                                    y={y - 5}
                                    fontSize="10"
                                    fontWeight="650"
                                    fill={color}
                                    textAnchor="middle"
                                >
                                    {valueFormatter(point.value)}
                                </text>
                            )}
                            <text
                                x={x + barWidth / 2}
                                y={VIEW_H - 8}
                                fontSize="10"
                                fill={point.isCurrent ? "var(--ink-secondary)" : "var(--chart-axis-text)"}
                                fontWeight={point.isCurrent ? 650 : 400}
                                textAnchor="middle"
                            >
                                {point.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
