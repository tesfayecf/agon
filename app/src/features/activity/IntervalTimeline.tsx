import { useMemo, useRef, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import type { IntervalBasis, IntervalKind, WorkoutInterval } from "./activity.service";
import { useElementWidth } from "../../shared/hooks/useElementWidth";
import { CHART_PAD_R, CHART_PAD_X, INTERVAL_KIND_LABELS, formatClock, formatMeters, paceProfile, type ResolvedInterval, type Series } from "./intervals";

interface IntervalTimelineProps {
    series: Series;
    /** Resolved intervals, in the order they are stored. */
    intervals: ResolvedInterval[];
    selected: number | null;
    onSelect: (index: number | null) => void;
    /** Receives the new list of intervals (user-input fields); the parent re-resolves them. */
    onChange: (intervals: WorkoutInterval[]) => void;
    axis: IntervalBasis;
    onAxisChange: (axis: IntervalBasis) => void;
    newKind: IntervalKind;
}

type DragMode = "create" | "move" | "start" | "end";

interface Drag {
    mode: DragMode;
    index: number;
    origin: number; // pointer position (axis units) at pointer down
    startVal: number;
    endVal: number;
    lo: number; // free space available to the dragged interval
    hi: number;
    moved: boolean;
}

const HEIGHT = 74;
const LANE_TOP = 4;
const LANE_H = 46;
const HANDLE_W = 7;
const STEP: Record<IntervalBasis, number> = { time: 1, distance: 10 };
const MIN_LENGTH: Record<IntervalBasis, number> = { time: 5, distance: 20 };
const KEY_STEP: Record<IntervalBasis, number> = { time: 5, distance: 50 };

const input = (iv: WorkoutInterval): WorkoutInterval => ({ kind: iv.kind, ...(iv.label ? { label: iv.label } : {}), basis: iv.basis, start: iv.start, length: iv.length });

export const IntervalTimeline = ({ series, intervals, selected, onSelect, onChange, axis, onAxisChange, newKind }: IntervalTimelineProps): ReactElement => {
    const svgRef = useRef<SVGSVGElement>(null);
    const drag = useRef<Drag | null>(null);

    const { ref: wrapRef, width: measured } = useElementWidth<HTMLDivElement>(650);
    const svgW = Math.max(240, Math.floor(measured) - 2); // minus the svg border
    const chartW = svgW - CHART_PAD_X - CHART_PAD_R;
    const total = axis === "time" ? series.duration : series.totalMeters;
    const xOf = (value: number): number => CHART_PAD_X + (Math.min(Math.max(value, 0), total) / total) * chartW;
    const snap = (value: number): number => Math.round(value / STEP[axis]) * STEP[axis];

    // Axis-unit range of an interval.
    const rangeOf = (iv: ResolvedInterval): [number, number] => (axis === "time" ? [iv.startSeconds, iv.endSeconds] : [iv.startMeters, iv.endMeters]);

    // Faint pace profile behind the intervals (faster is higher).
    const profilePath = useMemo(() => {
        const samples = paceProfile(series);
        const values = samples.flatMap((p) => (p.v === null ? [] : [p.v])).sort((a, b) => a - b);
        if (values.length === 0) return "";
        const lo = values[Math.floor(values.length * 0.02)] ?? 0;
        const hi = values[Math.floor(values.length * 0.98)] ?? 1;
        const span = hi - lo === 0 ? 1 : hi - lo;
        const axisTotal = axis === "time" ? series.duration : series.totalMeters;
        let d = "";
        let penDown = false;
        for (const p of samples) {
            if (p.v === null) {
                penDown = false;
                continue;
            }
            const at = axis === "time" ? p.t : (series.cum[p.t] ?? 0);
            const x = CHART_PAD_X + (at / axisTotal) * chartW;
            const y = LANE_TOP + Math.min(1, Math.max(0, (p.v - lo) / span)) * LANE_H;
            d += `${penDown ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)} `;
            penDown = true;
        }
        return d;
    }, [series, axis, chartW]);

    const valueAt = (clientX: number): number => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect === undefined || rect.width === 0) return 0;
        const x = clientX - rect.left - (svgRef.current?.clientLeft ?? 0) - CHART_PAD_X;
        return (Math.min(Math.max(x, 0), chartW) / chartW) * total;
    };

    // Free space around the interval at `index` (or around a point when index is -1).
    const neighbours = (index: number, around: number): [number, number] => {
        let lo = 0;
        let hi = total;
        intervals.forEach((iv, i) => {
            if (i === index || iv.durationSeconds <= 0) return;
            const [s, e] = rangeOf(iv);
            if (e <= around + 1e-6) lo = Math.max(lo, e);
            if (s >= around - 1e-6) hi = Math.min(hi, s);
        });
        return [lo, hi];
    };

    const write = (index: number, s: number, e: number): void => {
        const base = intervals.map(input);
        const current = base[index];
        if (current === undefined) return;
        base[index] = { ...current, basis: axis, start: s, length: e - s };
        onChange(base);
    };

    const beginDrag = (e: PointerEvent<SVGElement>, mode: DragMode, index: number): void => {
        e.preventDefault();
        e.stopPropagation();
        svgRef.current?.setPointerCapture(e.pointerId);
        const origin = valueAt(e.clientX);
        const iv = intervals[index];
        const [s, en] = iv === undefined ? [origin, origin] : rangeOf(iv);
        const [lo, hi] = neighbours(index, mode === "create" ? origin : (s + en) / 2);
        drag.current = { mode, index, origin, startVal: s, endVal: en, lo, hi, moved: false };
    };

    const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
        const d = drag.current;
        if (d === null) return;
        const value = valueAt(e.clientX);
        const min = MIN_LENGTH[axis];
        if (d.mode === "create") {
            const s = snap(Math.max(d.lo, Math.min(d.origin, value)));
            const en = snap(Math.min(d.hi, Math.max(d.origin, value)));
            if (en - s < min) return;
            d.moved = true;
            if (d.index < 0) {
                // First time the drag is long enough: insert the new interval in start order.
                const base = intervals.map(input);
                let at = intervals.findIndex((iv) => rangeOf(iv)[0] > s);
                if (at < 0) at = base.length;
                base.splice(at, 0, { kind: newKind, basis: axis, start: s, length: en - s });
                d.index = at;
                onChange(base);
                onSelect(at);
            } else {
                write(d.index, s, en);
            }
            return;
        }
        if (Math.abs(value - d.origin) > 0) d.moved = true;
        if (d.mode === "move") {
            const len = d.endVal - d.startVal;
            const s = snap(Math.min(Math.max(d.startVal + (value - d.origin), d.lo), d.hi - len));
            write(d.index, s, s + len);
        } else if (d.mode === "start") {
            write(d.index, snap(Math.min(Math.max(value, d.lo), d.endVal - min)), d.endVal);
        } else {
            write(d.index, d.startVal, snap(Math.max(Math.min(value, d.hi), d.startVal + min)));
        }
    };

    const endDrag = (e: PointerEvent<SVGSVGElement>): void => {
        const d = drag.current;
        drag.current = null;
        if (svgRef.current?.hasPointerCapture(e.pointerId) === true) svgRef.current.releasePointerCapture(e.pointerId);
        if (d === null || d.moved) return;
        onSelect(d.mode === "create" || d.index < 0 ? null : d.index);
    };

    const onKeyDown = (e: KeyboardEvent<SVGGElement>, index: number): void => {
        const iv = intervals[index];
        if (iv === undefined) return;
        const [s, en] = rangeOf(iv);
        const step = KEY_STEP[axis];
        const [lo, hi] = neighbours(index, (s + en) / 2);
        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            onChange(intervals.map(input).filter((_, i) => i !== index));
            onSelect(null);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const dir = e.key === "ArrowLeft" ? -1 : 1;
            if (e.shiftKey) write(index, s, Math.max(s + MIN_LENGTH[axis], Math.min(hi, en + dir * step)));
            else {
                const ns = Math.min(Math.max(s + dir * step, lo), hi - (en - s));
                write(index, ns, ns + (en - s));
            }
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // Up/Down lengthen or shorten the band by one step (1 s / 10 m), Shift for ten.
            e.preventDefault();
            const unit = STEP[axis] * (e.shiftKey ? 10 : 1);
            const next = Math.max(s + STEP[axis], Math.min(hi, en + (e.key === "ArrowUp" ? unit : -unit)));
            write(index, s, snap(next));
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(index);
        }
    };

    const ticks = svgW < 420 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    const labelOf = (value: number): string => (axis === "time" ? formatClock(value) : formatMeters(value));
    let workIndex = 0;

    return (
        <div className="iv-timeline" ref={wrapRef}>
            <div className="iv-timeline__bar">
                <div role="group" aria-label="Timeline axis" className="iv-segmented">
                    {(["time", "distance"] as const).map((a) => (
                        <button key={a} type="button" aria-pressed={axis === a} className={axis === a ? "is-active" : ""} onClick={() => onAxisChange(a)}>
                            {a === "time" ? "Time" : "Distance"}
                        </button>
                    ))}
                </div>
                <small className="iv-timeline__hint">Drag to add · drag a band to move · drag edges to resize · keys: ←/→ move, ↑/↓ length (Shift ×10)</small>
            </div>
            <svg
                ref={svgRef}
                width={svgW}
                height={HEIGHT}
                viewBox={`0 0 ${svgW} ${HEIGHT}`}
                className="iv-timeline__svg"
                role="group"
                aria-label={`Interval editor on the ${axis} axis`}
                onPointerDown={(e) => beginDrag(e, "create", -1)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <rect x={CHART_PAD_X} y={LANE_TOP} width={chartW} height={LANE_H} className="iv-lane" />
                {profilePath !== "" && <path d={profilePath} className="iv-profile" />}

                {intervals.map((iv, i) => {
                    if (iv.durationSeconds <= 0) return null;
                    const [s, en] = rangeOf(iv);
                    const x = xOf(s);
                    const w = Math.max(3, xOf(en) - x);
                    const isWork = iv.kind === "work";
                    if (isWork) workIndex++;
                    const handleW = Math.min(HANDLE_W, w / 2);
                    return (
                        <g
                            key={`${i}-${iv.kind}`}
                            className={`iv-band iv-band--${iv.kind}${selected === i ? " is-selected" : ""}`}
                            tabIndex={0}
                            role="button"
                            aria-label={`${iv.label || INTERVAL_KIND_LABELS[iv.kind]}, ${labelOf(s)} to ${labelOf(en)}`}
                            aria-pressed={selected === i}
                            onKeyDown={(e) => onKeyDown(e, i)}
                            onFocus={() => onSelect(i)}
                        >
                            <rect x={x} y={LANE_TOP} width={w} height={LANE_H} className="iv-band__fill iv-band__body" onPointerDown={(e) => beginDrag(e, "move", i)} />
                            {isWork && w >= 12 && (
                                <text x={x + w / 2} y={LANE_TOP + 14} fontSize="10" fontWeight="700" textAnchor="middle" className="iv-band__label" pointerEvents="none">
                                    {workIndex}
                                </text>
                            )}
                            <rect x={x} y={LANE_TOP} width={handleW} height={LANE_H} className="iv-handle" onPointerDown={(e) => beginDrag(e, "start", i)} />
                            <rect x={x + w - handleW} y={LANE_TOP} width={handleW} height={LANE_H} className="iv-handle" onPointerDown={(e) => beginDrag(e, "end", i)} />
                        </g>
                    );
                })}

                {ticks.map((r) => (
                    <g key={r}>
                        <line x1={CHART_PAD_X + r * chartW} x2={CHART_PAD_X + r * chartW} y1={LANE_TOP + LANE_H} y2={LANE_TOP + LANE_H + 4} className="iv-tick" />
                        <text x={CHART_PAD_X + r * chartW} y={LANE_TOP + LANE_H + 17} fontSize="10" fill="var(--chart-axis-text)" textAnchor={r === 0 ? "start" : r === 1 ? "end" : "middle"}>
                            {labelOf(r * total)}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};
