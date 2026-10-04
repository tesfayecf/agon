import type { ReactElement } from "react";

import { useElementWidth } from "../../../shared/hooks/useElementWidth";
import { pickVisibleLabelIndices } from "./chart-layout";

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
    ariaLabel?: string;
    /** Plot lower values higher, e.g. for pace where a lower number is faster. */
    invertY?: boolean;
}

const HEIGHT = 200;
const PAD_LEFT = 48;
const PAD_RIGHT = 12;
const PAD_TOP = 18;
const PAD_BOTTOM = 24;
const MIN_LABEL_SLOT = 40;

export const LineTrendChart = ({
    points,
    valueFormatter,
    emptyMessage,
    color = "var(--chart-2)",
    ariaLabel = "Weekly average trend",
    invertY = false,
}: LineTrendChartProps): ReactElement => {
    const { ref, width } = useElementWidth<HTMLDivElement>();

    if (points.length === 0) {
        return (
            <div className="chart-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const viewW = Math.max(width, 260);
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // Pad the domain so the line never sits flat against the top or bottom edge.
    const padding = rawMax - rawMin === 0 ? Math.max(rawMax * 0.1, 1) : (rawMax - rawMin) * 0.15;
    const minVal = rawMin - padding;
    const maxVal = rawMax + padding;
    const range = maxVal - minVal;

    const plotW = viewW - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const visibleLabels = pickVisibleLabelIndices(points.length, plotW, MIN_LABEL_SLOT);

    const coords = points.map((p, idx) => ({
        ...p,
        x: PAD_LEFT + (points.length > 1 ? (idx / (points.length - 1)) * plotW : plotW / 2),
        y: invertY ? PAD_TOP + ((p.value - minVal) / range) * plotH : PAD_TOP + plotH - ((p.value - minVal) / range) * plotH,
    }));

    const first = coords[0];
    const last = coords[coords.length - 1];
    const linePath = coords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");
    const areaPath =
        first !== undefined && last !== undefined
            ? `${linePath} L ${last.x} ${PAD_TOP + plotH} L ${first.x} ${PAD_TOP + plotH} Z`
            : "";
    const gradientId = `line-fade-${Math.round(minVal)}-${points.length}`;

    return (
        <div className="trend-chart" ref={ref}>
            <svg viewBox={`0 0 ${viewW} ${HEIGHT}`} className="trend-chart__svg" style={{ height: HEIGHT }} role="img" aria-label={ariaLabel}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {[0, 0.5, 1].map((ratio) => {
                    const y = PAD_TOP + plotH * ratio;
                    return (
                        <g key={ratio}>
                            <line x1={PAD_LEFT} y1={y} x2={viewW - PAD_RIGHT} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 4" />
                            <text x={PAD_LEFT - 8} y={y + 3.5} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                                {valueFormatter(invertY ? minVal + ratio * range : maxVal - ratio * range)}
                            </text>
                        </g>
                    );
                })}

                {areaPath !== "" && <path d={areaPath} fill={`url(#${gradientId})`} />}
                <path d={linePath} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

                {coords.map((pt, idx) => {
                    const isLast = idx === coords.length - 1;
                    return (
                        <g key={`${pt.label}-${idx}`}>
                            <title>{pt.tooltip ?? `${pt.label}: ${valueFormatter(pt.value)}`}</title>
                            {isLast && <circle cx={pt.x} cy={pt.y} r={7} fill={color} fillOpacity={0.18} />}
                            <circle cx={pt.x} cy={pt.y} r={isLast ? 4 : 3} fill={color} stroke="var(--surface)" strokeWidth={isLast ? 1.5 : 1} />
                            {visibleLabels.has(idx) && (
                                <text x={pt.x} y={HEIGHT - 8} fontSize="10" textAnchor="middle" fill="var(--chart-axis-text)">
                                    {pt.label}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
