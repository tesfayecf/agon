import { useMemo, useState, type ReactElement } from "react";
import { useElementWidth } from "../../shared/hooks/useElementWidth";
import { CHART_PAD_R, CHART_PAD_X, formatClock, formatIntervalPace, type Series } from "./intervals";
import { analyzeRun, type Split } from "./runInsights";

const signed = (value: number, digits = 1): string => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;

const HEIGHT = 128;
const LANE_TOP = 18;
const LANE_H = 84;
const GAP = 2;

/**
 * Splits laid out like the interval timeline: each km is a band as wide as its distance and as tall as its speed,
 * with average heart rate traced across them. Hover or focus a band for its numbers.
 */
const SplitsChart = ({ splits }: { splits: Split[] }): ReactElement => {
    const [active, setActive] = useState<number | null>(null);
    const { ref: wrapRef, width: measured } = useElementWidth<HTMLDivElement>(650);
    const svgW = Math.max(240, Math.floor(measured) - 2);
    const chartW = svgW - CHART_PAD_X - CHART_PAD_R;
    const total = splits.reduce((a, s) => a + s.meters, 0);
    const xOf = (meters: number): number => CHART_PAD_X + (meters / total) * chartW;

    const speeds = splits.map((s) => (s.paceSecondsPerKm > 0 ? 1000 / s.paceSecondsPerKm : 0));
    const moving = speeds.filter((v) => v > 0);
    // Scale from just under the slowest split so differences read clearly, like the pace profile.
    const lo = Math.min(...moving) * 0.85;
    const hi = Math.max(...moving);
    const heightOf = (v: number): number => (v <= 0 ? 0 : 6 + ((v - lo) / Math.max(1e-6, hi - lo)) * (LANE_H - 6));
    const fastest = speeds.indexOf(hi);

    const hrs = splits.map((s) => s.avgHeartRate).filter((h) => h > 0);
    const hrLo = Math.min(...hrs) - 3;
    const hrHi = Math.max(...hrs) + 3;
    const hrY = (h: number): number => LANE_TOP + 4 + (1 - (h - hrLo) / Math.max(1, hrHi - hrLo)) * (LANE_H - 8);

    let start = 0;
    const bands = splits.map((s, i) => {
        const x = xOf(start) + GAP / 2;
        const w = Math.max(2, xOf(start + s.meters) - xOf(start) - GAP);
        start += s.meters;
        return { s, i, x, w, h: heightOf(speeds[i] ?? 0) };
    });
    const hrPath = bands
        .filter((b) => b.s.avgHeartRate > 0)
        .map((b, k) => `${k === 0 ? "M" : "L"} ${(b.x + b.w / 2).toFixed(1)} ${hrY(b.s.avgHeartRate).toFixed(1)}`)
        .join(" ");

    const shown = active === null ? null : splits[active];
    const ticks = splits.length <= 12 ? bands : bands.filter((b) => (b.i + 1) % 5 === 0 || b.i === 0);

    return (
        <div className="iv-timeline splits-chart" ref={wrapRef}>
            <div className="iv-timeline__bar">
                <ul className="iv-legend splits-chart__legend">
                    <li>
                        <span className="iv-swatch splits-chart__swatch--pace" /> Pace
                    </li>
                    {hrs.length > 0 && (
                        <li>
                            <span className="splits-chart__swatch--hr" /> Heart rate
                        </li>
                    )}
                </ul>
                <small className="iv-timeline__hint splits-chart__readout" aria-live="polite">
                    {shown === undefined || shown === null ? (
                        "Hover a kilometre for details"
                    ) : (
                        <>
                            <strong>Km {shown.meters < 1000 ? (shown.km - 1 + shown.meters / 1000).toFixed(2) : shown.km}</strong> · {formatIntervalPace(shown.paceSecondsPerKm)} · {formatClock(shown.elapsedSeconds)}
                            {shown.avgHeartRate > 0 ? ` · ${Math.round(shown.avgHeartRate)} bpm` : ""}
                        </>
                    )}
                </small>
            </div>
            <svg width={svgW} height={HEIGHT} viewBox={`0 0 ${svgW} ${HEIGHT}`} className="iv-timeline__svg splits-chart__svg" role="group" aria-label="Pace and heart rate per kilometre" onPointerLeave={() => setActive(null)}>
                <rect x={CHART_PAD_X} y={LANE_TOP} width={chartW} height={LANE_H} className="iv-lane" />
                <text x={CHART_PAD_X - 6} y={LANE_TOP + 8} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                    {formatClock(1000 / hi)}
                </text>
                <text x={CHART_PAD_X - 6} y={LANE_TOP + LANE_H} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                    {formatClock(1000 / lo)}
                </text>

                {bands.map(({ s, i, x, w, h }) => (
                    <g
                        key={s.km}
                        className={`splits-chart__band${active === i ? " is-selected" : ""}${i === fastest ? " is-fastest" : ""}`}
                        tabIndex={0}
                        role="img"
                        aria-label={`Kilometre ${s.km}: ${formatIntervalPace(s.paceSecondsPerKm)}${s.avgHeartRate > 0 ? `, ${Math.round(s.avgHeartRate)} bpm` : ""}`}
                        onPointerEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive(null)}
                    >
                        <rect x={x} y={LANE_TOP} width={w} height={LANE_H} className="splits-chart__hit" />
                        <rect x={x} y={LANE_TOP + LANE_H - h} width={w} height={h} rx={2} className="splits-chart__bar" />
                    </g>
                ))}

                {hrPath !== "" && <path d={hrPath} className="splits-chart__hr" />}
                {bands.map(({ s, i, x, w }) =>
                    s.avgHeartRate > 0 ? <circle key={s.km} cx={x + w / 2} cy={hrY(s.avgHeartRate)} r={active === i ? 3.5 : 2} className="splits-chart__hr-dot" /> : null,
                )}

                {ticks.map(({ s, x, w }) => (
                    <g key={s.km}>
                        <line x1={x + w / 2} x2={x + w / 2} y1={LANE_TOP + LANE_H} y2={LANE_TOP + LANE_H + 4} className="iv-tick" />
                        <text x={x + w / 2} y={LANE_TOP + LANE_H + 17} fontSize="10" fill="var(--chart-axis-text)" textAnchor="middle">
                            {s.meters < 1000 ? (s.km - 1 + s.meters / 1000).toFixed(1) : s.km}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

export const RunInsightsPanel = ({ series }: { series: Series | null }): ReactElement => {
    const run = useMemo(() => analyzeRun(series), [series]);
    if (run === null) return <p className="workout-panel__note">This file has no usable time, speed or distance records to analyse.</p>;

    const stopped = run.elapsedSeconds - run.movingSeconds;
    const zoneTotal = run.zones.reduce((a, z) => a + z.seconds, 0);
    const split = run.negativeSplitIndex < 1 ? "Negative split" : "Positive split";

    return (
        <div className="run-insights">
            <section aria-label="Fade and drift">
                <h3>Fade &amp; drift</h3>
                <dl className="run-insights__stats">
                    <div>
                        <dt>{split}</dt>
                        <dd>{run.negativeSplitIndex.toFixed(3)}</dd>
                        <small>2nd ÷ 1st half pace</small>
                    </div>
                    <div>
                        <dt>Pace fade</dt>
                        <dd>{signed(run.fadePercent)}%</dd>
                        <small>
                            {formatIntervalPace(run.firstHalf.paceSecondsPerKm)} → {formatIntervalPace(run.secondHalf.paceSecondsPerKm)}
                        </small>
                    </div>
                    <div>
                        <dt>Heart-rate drift</dt>
                        <dd>{run.hrDriftPercent === null ? "—" : `${signed(run.hrDriftPercent)}%`}</dd>
                        <small>{run.hrDriftPercent === null ? "no heart-rate data" : `${Math.round(run.firstHalf.avgHeartRate)} → ${Math.round(run.secondHalf.avgHeartRate)} bpm`}</small>
                    </div>
                </dl>
                {run.hrDriftPercent !== null && <p className="workout-panel__note workout-panel__note--small">Drift under ~5% at even pace suggests the run really was easy.</p>}
            </section>

            <section aria-label="Splits and moving time">
                <h3>Splits &amp; moving time</h3>
                <p className="workout-panel__note">
                    Moving {formatClock(run.movingSeconds)} of {formatClock(run.elapsedSeconds)} elapsed
                    {stopped >= 30 ? ` (${formatClock(stopped)} stopped)` : ""} · pace {formatIntervalPace(run.movingPaceSecondsPerKm)} moving
                    {stopped >= 30 ? `, ${formatIntervalPace(run.elapsedPaceSecondsPerKm)} elapsed` : ""}
                </p>
                <SplitsChart splits={run.splits} />
            </section>

            <section aria-label="Heart-rate zones">
                <h3>Heart-rate zones</h3>
                {run.hasHeartRate ? (
                    <table className="record-table run-insights__zones">
                        <tbody>
                            {run.zones.map((z) => (
                                <tr key={z.zone}>
                                    <td>
                                        Z{z.zone} {z.label}
                                        <small>{z.maxBpm === null ? `${z.minBpm}+ bpm` : `${z.minBpm}–${z.maxBpm} bpm`}</small>
                                    </td>
                                    <td>
                                        <span className="run-insights__bar" style={{ width: `${zoneTotal > 0 ? (z.seconds / zoneTotal) * 100 : 0}%` }} />
                                    </td>
                                    <td>{formatClock(z.seconds)}</td>
                                    <td>{zoneTotal > 0 ? `${Math.round((z.seconds / zoneTotal) * 100)}%` : ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="workout-panel__note">No heart-rate data in this file.</p>
                )}
                <p className="workout-panel__note workout-panel__note--small">Zones are % of an observed max of {run.maxHr} bpm (50/60/70/80/90%).</p>
            </section>
        </div>
    );
};
