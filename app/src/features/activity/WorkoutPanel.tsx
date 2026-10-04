import { useEffect, useRef, useState, type ReactElement } from "react";
import type { IntervalBasis, IntervalKind, WorkoutInterval, WorkoutType } from "./activity.service";
import { IntervalTimeline } from "./IntervalTimeline";
import { RunInsightsPanel } from "./RunInsightsPanel";
import {
    INTERVAL_KIND_LABELS,
    WORKOUT_TYPE_LABELS,
    findProblems,
    formatClock,
    formatIntervalPace,
    formatMeters,
    parseClock,
    reorderIntervals,
    sortByStart,
    summarizeWork,
    type ResolvedInterval,
    type Series,
} from "./intervals";

interface WorkoutPanelProps {
    series: Series | null;
    workoutType: WorkoutType;
    /** Draft interval input, in stored order. */
    intervals: WorkoutInterval[];
    /** The same intervals resolved against the profile (derived time range, distance, pace, heart rate). */
    resolved: ResolvedInterval[];
    /** Selected interval, shared with the track view so it can highlight the same segment. */
    selected: number | null;
    onSelect: (index: number | null) => void;
    isDirty: boolean;
    isSaving: boolean;
    error: string | null;
    onTypeChange: (type: WorkoutType) => void;
    onIntervalsChange: (intervals: WorkoutInterval[]) => void;
    onSave: () => void;
    onDiscard: () => void;
}

const KINDS = Object.keys(INTERVAL_KIND_LABELS) as IntervalKind[];
const TYPES = Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[];

/**
 * Text input that parses and commits on blur or Enter, so half-typed values like "1:" don't fight the user.
 * ArrowUp / ArrowDown call onStep immediately (Shift = faster) with the text currently typed.
 */
const CommitInput = ({
    value,
    onCommit,
    onStep,
    label,
    placeholder,
    inputMode,
    width,
}: {
    value: string;
    onCommit: (text: string) => void;
    onStep?: (direction: 1 | -1, fast: boolean, text: string) => void;
    label: string;
    placeholder?: string;
    inputMode?: "numeric" | "text";
    width?: string;
}): ReactElement => {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    return (
        <input
            aria-label={label}
            placeholder={placeholder}
            value={text}
            inputMode={inputMode}
            style={width === undefined ? undefined : { width }}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => (text === value ? undefined : onCommit(text))}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") setText(value);
                else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && onStep !== undefined) {
                    e.preventDefault();
                    onStep(e.key === "ArrowUp" ? 1 : -1, e.shiftKey, text);
                }
            }}
        />
    );
};

export const WorkoutPanel = ({ series, workoutType, intervals, resolved, selected, onSelect: setSelected, isDirty, isSaving, error, onTypeChange, onIntervalsChange, onSave, onDiscard }: WorkoutPanelProps): ReactElement => {
    const [axis, setAxis] = useState<IntervalBasis>("time");
    const [newKind, setNewKind] = useState<IntervalKind>("work");
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dropAt, setDropAt] = useState<number | null>(null);
    const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    const { overlapping, outOfRange } = findProblems(resolved);
    const hasProblems = overlapping.size > 0 || outOfRange.size > 0;
    const summary = summarizeWork(resolved);

    // Intervals are kept in start order, so list order is the order they were run in.
    const commit = (next: WorkoutInterval[], focus?: WorkoutInterval): void => {
        const sorted = sortByStart(series, next);
        onIntervalsChange(sorted);
        if (focus !== undefined) setSelected(sorted.indexOf(focus));
    };

    const update = (index: number, patch: Partial<WorkoutInterval>): void => {
        const current = intervals[index];
        if (current === undefined) return;
        const changed = { ...current, ...patch };
        commit(
            intervals.map((iv, i) => (i === index ? changed : iv)),
            changed,
        );
    };

    const move = (from: number, to: number): void => {
        if (from === to) return;
        onIntervalsChange(reorderIntervals(series, resolved, from, to));
        setSelected(to);
        // Keep keyboard focus on the moved row's handle after React re-renders it.
        requestAnimationFrame(() => rowRefs.current[to]?.querySelector<HTMLElement>(".interval-handle-btn")?.focus());
    };

    const step = (iv: WorkoutInterval): number => (iv.basis === "time" ? 1 : 10);

    const changeBasis = (index: number, basis: IntervalBasis): void => {
        const r = resolved[index];
        if (r === undefined) return;
        // Keep the interval where it is: re-express its resolved range in the new unit.
        if (basis === "distance") update(index, { basis, start: Math.round(r.startMeters), length: Math.max(1, Math.round(r.distanceMeters)) });
        else update(index, { basis, start: Math.round(r.startSeconds), length: Math.max(1, Math.round(r.durationSeconds)) });
    };

    const addInterval = (): void => {
        const last = resolved.reduce((end, iv) => Math.max(end, iv.endSeconds), 0);
        const startSeconds = series !== null && last >= series.duration ? 0 : last;
        const added: WorkoutInterval = { kind: newKind, basis: "time", start: Math.round(startSeconds), length: 60 };
        commit([...intervals, added], added);
    };

    const removeInterval = (index: number): void => {
        onIntervalsChange(intervals.filter((_, i) => i !== index));
        setSelected(null);
    };

    const fieldText = (iv: WorkoutInterval, value: number): string => (iv.basis === "time" ? formatClock(value) : String(Math.round(value)));
    const parseField = (iv: WorkoutInterval, text: string): number | null => {
        if (iv.basis === "time") return parseClock(text);
        const n = Number(text.replace(/\s*m$/i, ""));
        return Number.isFinite(n) && text.trim() !== "" ? n : null;
    };

    let workNo = 0;

    return (
        <section className="workout-panel" aria-label="Workout">
            <div className="workout-panel__head">
                <div className="form-field workout-panel__type">
                    <label htmlFor="workout-type">Workout</label>
                    <select id="workout-type" value={workoutType} onChange={(e) => onTypeChange(e.target.value as WorkoutType)}>
                        {TYPES.map((t) => (
                            <option key={t} value={t}>
                                {WORKOUT_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </select>
                </div>
                {workoutType === "intervals" && (
                    <>
                        <div className="form-field workout-panel__kind">
                            <label htmlFor="new-interval-kind">New</label>
                            <select id="new-interval-kind" value={newKind} onChange={(e) => setNewKind(e.target.value as IntervalKind)}>
                                {KINDS.map((k) => (
                                    <option key={k} value={k}>
                                        {INTERVAL_KIND_LABELS[k]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button type="button" className="btn btn-sm" onClick={addInterval}>
                            + Add interval
                        </button>
                        {summary !== "" && <strong className="workout-panel__summary">{summary}</strong>}
                    </>
                )}
                <div className="workout-panel__actions">
                    {isDirty && (
                        <button type="button" className="btn btn-sm" onClick={onDiscard} disabled={isSaving}>
                            Discard
                        </button>
                    )}
                    <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={!isDirty || isSaving || (workoutType === "intervals" && hasProblems)}>
                        {isSaving ? "Saving…" : "Save workout"}
                    </button>
                </div>
            </div>

            {error !== null && (
                <p role="alert" className="workout-panel__error">
                    {error}
                </p>
            )}

            {workoutType !== "intervals" && intervals.length > 0 && <p className="workout-panel__note">Saving with another workout type removes the intervals below.</p>}

            {workoutType !== "intervals" && <RunInsightsPanel series={series} />}

            {workoutType === "intervals" && (
                <>
                    {series === null ? (
                        <p className="workout-panel__note">This file has no usable time, speed or distance records, so intervals can't be placed on a profile.</p>
                    ) : (
                        <IntervalTimeline series={series} intervals={resolved} selected={selected} onSelect={setSelected} onChange={commit} axis={axis} onAxisChange={setAxis} newKind={newKind} />
                    )}

                    {intervals.length === 0 ? (
                        <p className="workout-panel__note">No intervals yet. Drag on the profile above, or use “Add interval”.</p>
                    ) : (
                        <div className="workout-panel__table">
                            <table className="record-table interval-table">
                                <thead>
                                    <tr>
                                        <th aria-label="Reorder" />
                                        <th>Type</th>
                                        <th>Label</th>
                                        <th>By</th>
                                        <th>Start</th>
                                        <th>Length</th>
                                        <th>Range</th>
                                        <th>Pace</th>
                                        <th>HR avg / max</th>
                                        <th aria-label="Remove" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {intervals.map((iv, i) => {
                                        const r = resolved[i];
                                        if (iv.kind === "work") workNo++;
                                        const problem = overlapping.has(i) ? "Overlaps another interval" : outOfRange.has(i) ? "Outside the activity" : null;
                                        return (
                                            <tr
                                                key={i}
                                                ref={(el) => {
                                                    rowRefs.current[i] = el;
                                                }}
                                                className={`${selected === i ? "is-selected" : ""}${problem !== null ? " has-problem" : ""}${dragFrom === i ? " is-dragging" : ""}${dropAt === i && dragFrom !== null && dragFrom !== i ? (dragFrom < i ? " is-drop-after" : " is-drop-before") : ""}`}
                                                onClick={() => setSelected(i)}
                                                onFocus={() => setSelected(i)}
                                                onDragOver={(e) => {
                                                    if (dragFrom === null) return;
                                                    e.preventDefault();
                                                    e.dataTransfer.dropEffect = "move";
                                                    if (dropAt !== i) setDropAt(i);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (dragFrom !== null) move(dragFrom, i);
                                                    setDragFrom(null);
                                                    setDropAt(null);
                                                }}
                                            >
                                                <td className="interval-table__handle">
                                                    <button
                                                        type="button"
                                                        className="interval-handle-btn"
                                                        draggable
                                                        aria-label={`Move interval ${i + 1}: drag, or press Alt and an arrow key`}
                                                        title="Drag to reorder (or Alt+↑ / Alt+↓)"
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.effectAllowed = "move";
                                                            e.dataTransfer.setData("text/plain", String(i));
                                                            const row = e.currentTarget.closest("tr");
                                                            if (row !== null) e.dataTransfer.setDragImage(row, 16, 16);
                                                            setDragFrom(i);
                                                        }}
                                                        onDragEnd={() => {
                                                            setDragFrom(null);
                                                            setDropAt(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                                                                e.preventDefault();
                                                                move(i, Math.min(intervals.length - 1, Math.max(0, i + (e.key === "ArrowUp" ? -1 : 1))));
                                                            }
                                                        }}
                                                    >
                                                        ⠿
                                                    </button>
                                                </td>
                                                <td>
                                                    <select aria-label={`Interval ${i + 1} type`} value={iv.kind} onChange={(e) => update(i, { kind: e.target.value as IntervalKind })}>
                                                        {KINDS.map((k) => (
                                                            <option key={k} value={k}>
                                                                {INTERVAL_KIND_LABELS[k]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <CommitInput label={`Interval ${i + 1} label`} placeholder={iv.kind === "work" ? `Rep ${workNo}` : ""} value={iv.label ?? ""} width="5.5rem" onCommit={(text) => update(i, { label: text.trim() })} />
                                                </td>
                                                <td>
                                                    <select aria-label={`Interval ${i + 1} measured by`} value={iv.basis} onChange={(e) => changeBasis(i, e.target.value as IntervalBasis)}>
                                                        <option value="time">Time</option>
                                                        <option value="distance">Distance</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <CommitInput
                                                        label={`Interval ${i + 1} start ${iv.basis === "time" ? "(m:ss)" : "(meters)"}`}
                                                        value={fieldText(iv, iv.start)}
                                                        inputMode={iv.basis === "time" ? "text" : "numeric"}
                                                        width="4.25rem"
                                                        onCommit={(text) => {
                                                            const v = parseField(iv, text);
                                                            if (v !== null && v >= 0) update(i, { start: v });
                                                        }}
                                                        onStep={(dir, fast, text) => update(i, { start: Math.max(0, (parseField(iv, text) ?? iv.start) + dir * step(iv) * (fast ? 10 : 1)) })}
                                                    />
                                                    <small className="interval-table__unit">{iv.basis === "time" ? "m:ss" : "m"}</small>
                                                </td>
                                                <td>
                                                    <CommitInput
                                                        label={`Interval ${i + 1} length ${iv.basis === "time" ? "(m:ss)" : "(meters)"}`}
                                                        value={fieldText(iv, iv.length)}
                                                        inputMode={iv.basis === "time" ? "text" : "numeric"}
                                                        width="4.25rem"
                                                        onCommit={(text) => {
                                                            const v = parseField(iv, text);
                                                            if (v !== null && v > 0) update(i, { length: v });
                                                        }}
                                                        onStep={(dir, fast, text) => update(i, { length: Math.max(step(iv), (parseField(iv, text) ?? iv.length) + dir * step(iv) * (fast ? 10 : 1)) })}
                                                    />
                                                    <small className="interval-table__unit">{iv.basis === "time" ? "m:ss" : "m"}</small>
                                                </td>
                                                <td className="interval-table__derived">
                                                    {r !== undefined && r.durationSeconds > 0 ? (
                                                        <>
                                                            {formatClock(r.startSeconds)}–{formatClock(r.endSeconds)}
                                                            <small>
                                                                {formatMeters(r.startMeters)}–{formatMeters(r.endMeters)} · {formatMeters(r.distanceMeters)}
                                                            </small>
                                                        </>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                                <td className="interval-table__derived">{r !== undefined ? formatIntervalPace(r.avgPaceSecondsPerKm) : "—"}</td>
                                                <td className="interval-table__derived">{r !== undefined && r.avgHeartRate > 0 ? `${Math.round(r.avgHeartRate)} / ${Math.round(r.maxHeartRate)}` : "—"}</td>
                                                <td>
                                                    <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove interval ${i + 1}`} onClick={() => removeInterval(i)}>
                                                        ✕
                                                    </button>
                                                    {problem !== null && <small className="interval-table__problem">{problem}</small>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {intervals.length > 0 && (
                        <p className="workout-panel__note workout-panel__note--small">
                            Drag ⠿ to reorder (lengths stay, positions swap) · ↑/↓ in Start or Length: ±1 s or ±10 m, Shift ×10.
                        </p>
                    )}
                    {hasProblems && <p role="alert" className="workout-panel__error">Fix the highlighted intervals before saving: they must not overlap and must start within the activity.</p>}
                </>
            )}
        </section>
    );
};
