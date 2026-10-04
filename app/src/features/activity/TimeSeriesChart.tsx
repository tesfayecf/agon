import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import type { ActivityRecord } from "./activity.service";
import { useElementWidth } from "../../shared/hooks/useElementWidth";
import { CHART_PAD_R, CHART_PAD_X, buildSeries, INTERVAL_KIND_LABELS, elapsedSeconds, formatClock, formatIntervalPace, MIN_PACE_SPEED, paceProfile, type PaceSample as Point, type ResolvedInterval, type Series } from "./intervals";

interface TimeSeriesChartProps {
    records: ActivityRecord[];
    /** Per-second profile; built from the records when omitted. */
    series?: Series | null;
    intervals?: ResolvedInterval[];
    /** When given, the route is offered as the first (and default) view next to the metrics. */
    trackView?: ReactNode;
}

type MetricKey = "track" | "pace" | "speed" | "heartRate" | "altitude" | "distance";

interface MetricConfig {
    label: string;
    unit: string;
    color: string;
    /** Pace is plotted with faster at the top. */
    invert?: boolean;
    format: (value: number) => string;
}

const metricConfig: Record<MetricKey, MetricConfig> = {
    track: { label: "Track", unit: "", color: "var(--chart-2)", format: (v) => v.toFixed(0) },
    pace: { label: "Pace", unit: "min/km", color: "var(--chart-2)", invert: true, format: (v) => formatClock(v) },
    speed: { label: "Speed", unit: "m/s", color: "var(--chart-2)", format: (v) => v.toFixed(1) },
    heartRate: { label: "Heart Rate", unit: "bpm", color: "var(--chart-3)", format: (v) => v.toFixed(0) },
    altitude: { label: "Altitude", unit: "m", color: "var(--chart-1)", format: (v) => v.toFixed(0) },
    distance: { label: "Distance", unit: "m", color: "var(--chart-4)", format: (v) => v.toFixed(0) },
};

const recordMetrics = ["speed", "heartRate", "altitude", "distance"] as const;

const percentile = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))] ?? 0;

const HEIGHT = 170;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

export const TimeSeriesChart = ({ records, series: providedSeries, intervals = [], trackView }: TimeSeriesChartProps): ReactElement => {
    const series = useMemo(() => (providedSeries === undefined ? buildSeries(records) : providedSeries), [providedSeries, records]);
    const { ref: wrapRef, width: measured } = useElementWidth<HTMLDivElement>(650);
    const svgW = Math.max(240, Math.floor(measured) - 2); // minus the box border
    const datasets = useMemo(() => {
        const out: Partial<Record<MetricKey, Point[]>> = {};
        const samples = elapsedSeconds(records);
        for (const key of recordMetrics) {
            const points: Point[] = [];
            for (const { t, rec } of samples) {
                const value = rec[key];
                if (typeof value === "number" && !Number.isNaN(value)) points.push({ t, v: value });
            }
            if (points.length > 0) out[key] = points;
        }
        if (series !== null && series.speed.some((v) => v > MIN_PACE_SPEED)) out.pace = paceProfile(series);
        return out;
    }, [records, series]);

    const availableMetrics = (["track", "pace", "speed", "heartRate", "altitude", "distance"] as MetricKey[]).filter((key) => (key === "track" ? trackView !== undefined : datasets[key] !== undefined));
    const [activeMetric, setActiveMetric] = useState<MetricKey>(trackView !== undefined ? "track" : "pace");

    if (availableMetrics.length === 0) {
        return (
            <div ref={wrapRef} className="ts-chart ts-chart--empty">
                <p>No numerical time series metrics available in this file.</p>
            </div>
        );
    }

    const currentMetric: MetricKey = availableMetrics.includes(activeMetric) ? activeMetric : (availableMetrics[0] ?? "speed");
    const cfg = metricConfig[currentMetric];
    const data = datasets[currentMetric] ?? [];
    const defined = data.flatMap((d) => (d.v === null ? [] : [d.v]));
    const sorted = [...defined].sort((a, b) => a - b);
    // Pace has GPS outliers (near-standstill gives huge values), so clip it to a robust range.
    const minVal = sorted.length === 0 ? 0 : currentMetric === "pace" ? percentile(sorted, 0.02) : (sorted[0] ?? 0);
    const maxVal = sorted.length === 0 ? 100 : currentMetric === "pace" ? percentile(sorted, 0.98) : (sorted[sorted.length - 1] ?? 100);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const totalTime = series?.duration ?? Math.max(1, ...data.map((d) => d.t));
    const chartW = svgW - CHART_PAD_X - CHART_PAD_R;
    const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const xOf = (t: number): number => CHART_PAD_X + (Math.min(Math.max(t, 0), totalTime) / totalTime) * chartW;
    const yOf = (v: number): number => {
        const ratio = Math.min(1, Math.max(0, (v - minVal) / range));
        return PAD_TOP + (cfg.invert === true ? ratio : 1 - ratio) * chartH;
    };

    let pathData = "";
    let penDown = false;
    for (const d of data) {
        if (d.v === null) {
            penDown = false;
            continue;
        }
        pathData += `${penDown ? "L" : "M"} ${xOf(d.t).toFixed(1)} ${yOf(d.v).toFixed(1)} `;
        penDown = true;
    }

    const visibleIntervals = intervals.filter((iv) => iv.durationSeconds > 0);
    let workIndex = 0;

    const yTicks = [0, 1 / 3, 2 / 3, 1];
    const xTicks = svgW < 420 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    const kindsShown = (["work", "recovery", "warmup", "cooldown"] as const).filter((kind) => visibleIntervals.some((iv) => iv.kind === kind));

    return (
        <div ref={wrapRef} className="ts-chart">
            <div className="ts-chart__head">
                <strong className="ts-chart__title">
                    {cfg.label}
                    {cfg.unit !== "" && (
                        <small>
                            {" "}
                            ({cfg.unit}
                            {cfg.invert === true ? ", faster is higher" : ""})
                        </small>
                    )}
                </strong>
                {(kindsShown.length > 0 || currentMetric === "track") && (
                    <ul className="iv-legend ts-chart__legend" aria-label="Legend">
                        {currentMetric === "track" && (
                            <>
                                <li>
                                    <span className="track-view__dot track-view__dot--start" aria-hidden="true" />
                                    Start
                                </li>
                                <li>
                                    <span className="track-view__dot track-view__dot--end" aria-hidden="true" />
                                    Finish
                                </li>
                            </>
                        )}
                        {kindsShown.map((kind) => (
                            <li key={kind}>
                                <span className={`iv-swatch iv-swatch--${kind}`} aria-hidden="true" />
                                {INTERVAL_KIND_LABELS[kind]}
                            </li>
                        ))}
                    </ul>
                )}
                <div className="ts-chart__metrics" role="group" aria-label="Chart metric">
                    {availableMetrics.map((key) => (
                        <button key={key} type="button" onClick={() => setActiveMetric(key)} aria-pressed={currentMetric === key} className={currentMetric === key ? "is-active" : ""}>
                            {metricConfig[key].label}
                        </button>
                    ))}
                </div>
            </div>

            {currentMetric === "track" && trackView !== undefined ? (
                <div className="ts-chart__box ts-chart__box--track">{trackView}</div>
            ) : (
            <div className="ts-chart__box">
                <svg width={svgW} height={HEIGHT} viewBox={`0 0 ${svgW} ${HEIGHT}`} style={{ display: "block" }} role="img" aria-label={`${cfg.label} over time${visibleIntervals.length > 0 ? " with intervals" : ""}`}>
                    {yTicks.map((ratio) => {
                        const y = PAD_TOP + chartH * ratio;
                        const val = cfg.invert === true ? minVal + ratio * range : maxVal - ratio * range;
                        return (
                            <g key={ratio}>
                                <line x1={CHART_PAD_X} y1={y} x2={svgW - CHART_PAD_R} y2={y} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                                <text x={CHART_PAD_X - 6} y={y + 3.5} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                                    {cfg.format(val)}
                                </text>
                            </g>
                        );
                    })}

                    {visibleIntervals.map((iv, i) => {
                        const x = xOf(iv.startSeconds);
                        const w = Math.max(1.5, xOf(iv.endSeconds) - x);
                        const isWork = iv.kind === "work";
                        if (isWork) workIndex++;
                        return (
                            <g key={`${iv.startSeconds}-${i}`} className={`iv-band iv-band--${iv.kind}`}>
                                <title>{`${iv.label || INTERVAL_KIND_LABELS[iv.kind]} · ${formatClock(iv.startSeconds)}–${formatClock(iv.endSeconds)} · ${formatIntervalPace(iv.avgPaceSecondsPerKm)}${iv.avgHeartRate > 0 ? ` · HR ${Math.round(iv.avgHeartRate)}` : ""}`}</title>
                                <rect x={x} y={PAD_TOP} width={w} height={chartH} className="iv-band__fill" />
                                <line x1={x} x2={x} y1={PAD_TOP} y2={PAD_TOP + chartH} className="iv-band__edge" />
                                {isWork && w >= 12 && (
                                    <text x={x + w / 2} y={PAD_TOP + 11} fontSize="10" fontWeight="700" textAnchor="middle" className="iv-band__label">
                                        {workIndex}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {pathData !== "" && <path d={pathData} fill="none" stroke={cfg.color} strokeWidth="1.75" strokeLinejoin="round" />}

                    {xTicks.map((ratio) => (
                        <text key={ratio} x={CHART_PAD_X + ratio * chartW} y={HEIGHT - 6} fontSize="10" fill="var(--chart-axis-text)" textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"}>
                            {formatClock(ratio * totalTime)}
                        </text>
                    ))}
                </svg>
            </div>
            )}
        </div>
    );
};
