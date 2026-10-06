import { useMemo, useState, type ReactElement } from "react";

import type { IntervalAnalytics, IntervalSession, SessionSegment } from "../activity/activity.service";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { EmptyState } from "../../shared/components/StateViews";
import { formatDate, formatDayMonth, formatDistance, formatDuration, formatHeartRate, formatPace } from "../../shared/utils/format";
import { formatClock, formatMeters, INTERVAL_KIND_LABELS } from "../activity/intervals";
import { BarTrendChart } from "./charts/BarTrendChart";
import { IntervalSessionStrip } from "./charts/IntervalSessionStrip";
import { LineTrendChart } from "./charts/LineTrendChart";
import { defaultRepDuration, describeFade, formatPercent, formatRatio, paceChange, round1, weekLabel } from "./dashboard.utils";

interface IntervalsTabProps {
    intervals: IntervalAnalytics;
}

/** Rep lengths need at least this many sessions before a progression line means anything. */
const MIN_PROGRESSION_SESSIONS = 2;
const COLLAPSED_SESSION_ROWS = 8;

/**
 * Compact inline bar strip showing the interval pattern at a glance.
 * Each segment's width is proportional to its duration; work reps are vivid,
 * recoveries are dim, warm-up / cool-down are barely visible — so the work/rest
 * rhythm pops out without reading a single number.
 */
const MiniIntervalStrip = ({ segments }: { segments: SessionSegment[] }): ReactElement | null => {
    if (segments.length === 0) return null;
    const workCount = segments.filter((s) => s.kind === "work").length;
    return (
        <span className="iv-mini-strip" role="img" aria-label={`${workCount} work reps across ${segments.length} segments`}>
            {segments.map((seg, i) => (
                <span
                    key={i}
                    className={`iv-mini-strip__seg iv-mini-strip__seg--${seg.kind}`}
                    style={{ flex: `${Math.max(1, seg.durationSeconds)} 0 0` }}
                    title={`${INTERVAL_KIND_LABELS[seg.kind]} · ${formatClock(seg.durationSeconds)}`}
                />
            ))}
        </span>
    );
};

const FadeChip = ({ fadePercent }: { fadePercent: number | null }): ReactElement | null => {
    const fade = describeFade(fadePercent);
    if (fade === null) return null;
    return (
        <span className={`chip${fade.tone === "flat" ? "" : ` chip--${fade.tone}`}`} title="Last rep vs. first rep of the session's most common length">
            Last rep {fade.label.toLowerCase()}
        </span>
    );
};

const SessionBreakdown = ({ session }: { session: IntervalSession }): ReactElement => {
    let repIndex = 0;
    return (
        <Card
            title={`${session.repCount} intervals · ${formatClock(session.workSeconds)} work`}
            eyebrow={`Session breakdown · ${formatDate(session.date)}`}
            accent="var(--chart-4)"
            actions={
                <div className="chip-row">
                    <FadeChip fadePercent={session.fadePercent} />
                    {session.recoverySeconds > 0 && <span className="chip">Work:rest {formatRatio(session.workSeconds / session.recoverySeconds)}</span>}
                </div>
            }
        >
            <IntervalSessionStrip session={session} />
            <ul className="iv-legend" aria-label="Legend">
                <li>
                    <span className="iv-swatch iv-swatch--work" aria-hidden="true" /> Work
                </li>
                <li>
                    <span className="iv-swatch iv-swatch--recovery" aria-hidden="true" /> Recovery
                </li>
                <li>
                    <span className="iv-swatch iv-swatch--warmup" aria-hidden="true" /> Warm-up / cool-down
                </li>
                <li>Bar height = speed</li>
            </ul>
            <div className="table-scroll">
                <table className="record-table session-table">
                    <thead>
                        <tr>
                            <th scope="col">Rep</th>
                            <th scope="col">Length</th>
                            <th scope="col">Distance</th>
                            <th scope="col">Pace</th>
                            <th scope="col">HR avg / max</th>
                        </tr>
                    </thead>
                    <tbody>
                        {session.reps.map((rep) => {
                            repIndex++;
                            return (
                                <tr key={repIndex}>
                                    <td>
                                        {repIndex}
                                        {rep.label !== undefined && rep.label !== "" && <small> {rep.label}</small>}
                                    </td>
                                    <td>{formatClock(rep.durationSeconds)}</td>
                                    <td>{formatMeters(rep.distanceMeters)}</td>
                                    <td>
                                        {formatPace(rep.avgPaceSecondsPerKm)}
                                        {!rep.plausible && <small className="session-table__flag"> GPS glitch, not counted</small>}
                                    </td>
                                    <td>{rep.avgHeartRate > 0 ? `${rep.avgHeartRate.toFixed(0)} / ${rep.maxHeartRate.toFixed(0)}` : "—"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

/** Labelled interval sessions: how fast the reps are getting, how much quality work is done, and how well it is paced. */
export const IntervalsTab = ({ intervals }: IntervalsTabProps): ReactElement => {
    const sessions = intervals.sessions;
    const latest = sessions[sessions.length - 1];
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showAllSessions, setShowAllSessions] = useState(false);

    const progression = useMemo(() => intervals.repProgression.filter((s) => s.sessionCount >= MIN_PROGRESSION_SESSIONS), [intervals.repProgression]);
    const [repDuration, setRepDuration] = useState<number | null>(() => defaultRepDuration(progression));
    const activeSeries = progression.find((s) => s.durationSeconds === repDuration) ?? progression[0];
    const repChange = activeSeries !== undefined ? paceChange(activeSeries.points.map((p) => p.avgPaceSecondsPerKm)) : null;

    const selected = sessions.find((s) => s.activityId === selectedId) ?? latest;
    const newestFirst = useMemo(() => [...sessions].reverse(), [sessions]);
    const visibleSessions = showAllSessions ? newestFirst : newestFirst.slice(0, COLLAPSED_SESSION_ROWS);
    const windowLabel = `last ${intervals.windowWeeks} weeks`;
    const latestFade = describeFade(latest?.fadePercent ?? null);

    if (latest === undefined) {
        return (
            <Card>
                <EmptyState
                    title="No interval sessions yet"
                    message={
                        intervals.unlabelledCount > 0
                            ? `${intervals.unlabelledCount} training${intervals.unlabelledCount === 1 ? " is" : "s are"} marked as intervals but no reps are labelled. Open a training and mark its work reps to see them here.`
                            : "Mark a training as an interval workout and label its reps to see rep pace, quality volume and pacing here."
                    }
                />
            </Card>
        );
    }

    return (
        <>
            <div className="kpi-grid">
                <MetricCard
                    label="Sessions"
                    value={String(intervals.sessionCount)}
                    icon="≣"
                    hint={`${windowLabel} · ${sessions.length} all-time`}
                    isAvailable={intervals.sessionCount > 0}
                />
                <MetricCard
                    label="Reps"
                    value={String(intervals.repCount)}
                    icon="◈"
                    hint={intervals.sessionCount > 0 ? `${round1(intervals.repCount / intervals.sessionCount)} per session` : windowLabel}
                    isAvailable={intervals.repCount > 0}
                />
                <MetricCard
                    label="Time at work"
                    value={formatDuration(intervals.workSeconds)}
                    icon="◷"
                    hint={`${formatDistance(intervals.workMeters)} in reps`}
                    isAvailable={intervals.workSeconds > 0}
                />
                <MetricCard
                    label="Work share"
                    value={formatPercent(intervals.workShare)}
                    icon="◴"
                    hint="of all training time"
                    isAvailable={intervals.workShare > 0}
                />
                <MetricCard
                    label="Work : rest"
                    value={formatRatio(intervals.avgWorkRestRatio)}
                    icon="⇄"
                    hint="average per session"
                    isAvailable={intervals.avgWorkRestRatio > 0}
                />
                <MetricCard
                    label="Latest pacing"
                    value={latestFade?.label ?? "—"}
                    icon="▲"
                    hint={`last rep vs. first · ${formatDayMonth(latest.date)}`}
                    isAvailable={latestFade !== null}
                />
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-grid__main">
                    <Card
                        title="Rep pace progression"
                        eyebrow="Average pace of reps of the same length"
                        accent="var(--chart-4)"
                        actions={
                            repChange !== null && Math.abs(repChange) >= 1 ? (
                                <span className={`chip chip--${repChange < 0 ? "positive" : "negative"}`} title="Latest session vs. the first one">
                                    {repChange < 0 ? "▲" : "▼"} {Math.abs(Math.round(repChange))} s/km {repChange < 0 ? "faster" : "slower"}
                                </span>
                            ) : undefined
                        }
                    >
                        {progression.length === 0 || activeSeries === undefined ? (
                            <div className="chart-empty">
                                <p>Repeat a rep length in at least two sessions to see its progression.</p>
                            </div>
                        ) : (
                            <>
                                <div className="chart-tabs chart-tabs--wrap" role="tablist" aria-label="Rep length">
                                    {progression.map((s) => (
                                        <button
                                            key={s.durationSeconds}
                                            type="button"
                                            role="tab"
                                            aria-selected={s.durationSeconds === activeSeries.durationSeconds}
                                            className={`chart-tab${s.durationSeconds === activeSeries.durationSeconds ? " is-active" : ""}`}
                                            onClick={() => setRepDuration(s.durationSeconds)}
                                            title={`${s.sessionCount} sessions`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                                <LineTrendChart
                                    points={activeSeries.points.map((p) => ({
                                        label: formatDayMonth(p.date),
                                        value: p.avgPaceSecondsPerKm,
                                        tooltip: `${formatDate(p.date)} · ${p.reps} × ${activeSeries.label} · ${formatPace(p.avgPaceSecondsPerKm)}${p.avgHeartRate > 0 ? ` · ${p.avgHeartRate.toFixed(0)} bpm` : ""}`,
                                    }))}
                                    valueFormatter={(v) => formatPace(v)}
                                    emptyMessage="No reps of this length yet."
                                    color="var(--chart-4)"
                                    ariaLabel={`Average pace of ${activeSeries.label} reps per session`}
                                    invertY
                                />
                            </>
                        )}
                    </Card>

                    {selected !== undefined && <SessionBreakdown session={selected} />}

                    <Card
                        title="Sessions"
                        eyebrow="Newest first · select one to see its breakdown"
                        accent="var(--chart-2)"
                        actions={
                            sessions.length > COLLAPSED_SESSION_ROWS ? (
                                <button type="button" className="btn btn-sm" onClick={() => setShowAllSessions((v) => !v)}>
                                    {showAllSessions ? "Show fewer" : `Show all ${sessions.length}`}
                                </button>
                            ) : undefined
                        }
                    >
                        <div className="table-scroll">
                            <table className="record-table session-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Date</th>
                                        <th scope="col">Session</th>
                                        <th scope="col">Work</th>
                                        <th scope="col">Pace</th>
                                        <th scope="col">HR</th>
                                        <th scope="col">Pacing</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleSessions.map((s) => {
                                        const fade = describeFade(s.fadePercent);
                                        const isSelected = s.activityId === selected?.activityId;
                                        return (
                                            <tr key={s.activityId} className={isSelected ? "is-selected" : undefined}>
                                                <td>{formatDayMonth(s.date)}</td>
                                                <td>
                                                    <button type="button" className="session-table__select" aria-pressed={isSelected} onClick={() => setSelectedId(s.activityId)}>
                                                        <span className="iv-mini-strip-wrap">
                                                            <MiniIntervalStrip segments={s.segments} />
                                                            <span className="iv-mini-strip__count">{s.repCount} rep{s.repCount === 1 ? "" : "s"}</span>
                                                        </span>
                                                    </button>
                                                </td>
                                                <td>{formatClock(s.workSeconds)}</td>
                                                <td>{formatPace(s.avgWorkPaceSecondsPerKm)}</td>
                                                <td>{formatHeartRate(s.avgWorkHeartRate)}</td>
                                                <td>{fade !== null ? <span className={`session-table__fade session-table__fade--${fade.tone}`}>{fade.label}</span> : "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <aside className="dashboard-grid__rail">
                    <Card title="Quality volume" eyebrow="Minutes in work reps per week" accent="var(--chart-4)">
                        <BarTrendChart
                            points={intervals.weeklyQuality.map((w) => ({
                                label: weekLabel(w.weekStart),
                                value: round1(w.workSeconds / 60),
                                isCurrent: w.isCurrent,
                                tooltip:
                                    w.workSeconds > 0
                                        ? `Week of ${w.weekStart}: ${formatClock(w.workSeconds)} of work (${formatPercent(w.totalSeconds > 0 ? w.workSeconds / w.totalSeconds : 0)} of ${formatDuration(w.totalSeconds)})`
                                        : `Week of ${w.weekStart}: no interval work`,
                            }))}
                            valueFormatter={(v) => `${Math.round(v)}′`}
                            emptyMessage="No interval work in this period yet."
                            color="var(--chart-4)"
                            ariaLabel="Minutes spent in work reps per week"
                        />
                    </Card>

                    <Card title="Work efficiency" eyebrow="Meters per heartbeat during reps" accent="var(--chart-5)">
                        <LineTrendChart
                            points={sessions
                                .filter((s) => s.workMetersPerBeat > 0)
                                .map((s) => ({
                                    label: formatDayMonth(s.date),
                                    value: s.workMetersPerBeat,
                                    tooltip: `${formatDate(s.date)} · ${s.structure} · ${formatPace(s.avgWorkPaceSecondsPerKm)} at ${formatHeartRate(s.avgWorkHeartRate)}`,
                                }))}
                            valueFormatter={(v) => `${v.toFixed(2)} m`}
                            emptyMessage="No reps with both pace and heart-rate data yet."
                            color="var(--chart-5)"
                            ariaLabel="Meters covered per heartbeat during work reps, per session"
                        />
                        <p className="card__note">Mixes rep lengths, so short-rep sessions sit higher; watch sessions of the same kind.</p>
                    </Card>

                    {intervals.unlabelledCount > 0 && (
                        <Card title="Not labelled yet" accent="var(--warning)">
                            <p className="card__note">
                                {intervals.unlabelledCount} training{intervals.unlabelledCount === 1 ? " is" : "s are"} marked as intervals without labelled
                                reps and {intervals.unlabelledCount === 1 ? "is" : "are"} left out of these figures.
                            </p>
                        </Card>
                    )}
                </aside>
            </div>
        </>
    );
};
