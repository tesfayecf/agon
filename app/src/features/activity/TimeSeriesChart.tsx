import { useState, type ReactElement } from "react";
import type { ActivityRecord } from "./activity.service";

interface TimeSeriesChartProps {
    records: ActivityRecord[];
}

type MetricKey = "speed" | "heartRate" | "altitude" | "distance";

const metricConfig: Record<MetricKey, { label: string; unit: string; color: string }> = {
    speed: { label: "Speed", unit: "m/s", color: "#2563eb" },
    heartRate: { label: "Heart Rate", unit: "bpm", color: "#dc2626" },
    altitude: { label: "Altitude", unit: "m", color: "#16a34a" },
    distance: { label: "Distance", unit: "m", color: "#d97706" },
};

export const TimeSeriesChart = ({ records }: TimeSeriesChartProps): ReactElement => {
    const [activeMetric, setActiveMetric] = useState<MetricKey>("speed");

    const validData = records
        .map((r, i) => ({ index: i, timestamp: r.timestamp ?? `#${i + 1}`, value: r[activeMetric] }))
        .filter((d): d is { index: number; timestamp: string; value: number } => typeof d.value === "number" && !isNaN(d.value));

    const availableMetrics = (["speed", "heartRate", "altitude", "distance"] as MetricKey[]).filter((key) =>
        records.some((r) => typeof r[key] === "number" && !isNaN(r[key] as number)),
    );

    if (availableMetrics.length === 0) {
        return (
            <div style={{ margin: "1.5rem 0", textAlign: "center", padding: "2rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <p style={{ color: "#64748b", margin: 0 }}>No numerical time series metrics available in this file.</p>
            </div>
        );
    }

    const firstMetric = availableMetrics[0];
    const currentMetric: MetricKey = (availableMetrics.includes(activeMetric) ? activeMetric : firstMetric) ?? "speed";
    const cfg = metricConfig[currentMetric];
    const values = validData.map((d) => d.value);
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 100;
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const width = 650;
    const height = 260;
    const padX = 50;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const points = validData.map((d, i) => ({
        ...d,
        x: padX + (validData.length > 1 ? (i / (validData.length - 1)) * chartW : chartW / 2),
        y: height - padY - ((d.value - minVal) / range) * chartH,
    }));

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const pathData = points.length > 0 ? points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "") : "";

    return (
        <div style={{ margin: "1.5rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong>Time Series Chart ({cfg.label})</strong>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                    {availableMetrics.map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveMetric(key)}
                            style={{
                                padding: "0.3rem 0.6rem",
                                fontSize: "0.82rem",
                                borderRadius: "6px",
                                border: `1px solid ${currentMetric === key ? metricConfig[key].color : "#cbd5e1"}`,
                                background: currentMetric === key ? metricConfig[key].color : "#ffffff",
                                color: currentMetric === key ? "#ffffff" : "#334155",
                                cursor: "pointer",
                            }}
                        >
                            {metricConfig[key].label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem" }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = padY + chartH * ratio;
                        const val = maxVal - ratio * range;
                        return (
                            <g key={idx}>
                                <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                                <text x={padX - 8} y={y + 4} fontSize="10" fill="#64748b" textAnchor="end">
                                    {val.toFixed(1)}
                                </text>
                            </g>
                        );
                    })}

                    {points.length > 1 && firstPoint !== undefined && lastPoint !== undefined && (
                        <>
                            <path d={pathData} fill="none" stroke={cfg.color} strokeWidth="2.5" strokeLinejoin="round" />
                            <path
                                d={`${pathData} L ${lastPoint.x} ${height - padY} L ${firstPoint.x} ${height - padY} Z`}
                                fill={cfg.color}
                                fillOpacity="0.08"
                            />
                        </>
                    )}

                    {points.map((pt, idx) => (
                        <circle key={idx} cx={pt.x} cy={pt.y} r={points.length < 50 ? 3.5 : 1.5} fill={cfg.color} />
                    ))}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "0.8rem", color: "#64748b" }}>
                    <span>Start: {validData[0]?.timestamp ?? "N/A"}</span>
                    <span>Unit: {cfg.unit}</span>
                    <span>End: {validData[validData.length - 1]?.timestamp ?? "N/A"}</span>
                </div>
            </div>
        </div>
    );
};
