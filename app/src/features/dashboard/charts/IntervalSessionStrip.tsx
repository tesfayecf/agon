import type { ReactElement } from "react";

import type { IntervalSession } from "../../activity/activity.service";
import { useElementWidth } from "../../../shared/hooks/useElementWidth";
import { formatPace } from "../../../shared/utils/format";
import { INTERVAL_KIND_LABELS, formatClock } from "../../activity/intervals";

interface IntervalSessionStripProps {
    session: IntervalSession;
}

const HEIGHT = 132;
const PAD_X = 4;
const PAD_TOP = 8;
const LANE_H = 92;
const MIN_BAR_H = 4;
const MIN_NUMBER_SLOT = 14;

/**
 * One interval session laid out over time: each labelled segment is a bar as
 * wide as it lasted and as tall as it was fast, so the reps stand out from the
 * recoveries and a fading or accelerating session is visible at a glance.
 */
export const IntervalSessionStrip = ({ session }: IntervalSessionStripProps): ReactElement => {
    const { ref, width } = useElementWidth<HTMLDivElement>();
    const segments = session.segments;
    const last = segments[segments.length - 1];
    const first = segments[0];

    if (first === undefined || last === undefined) {
        return (
            <div className="chart-empty">
                <p>This session has no labelled segments.</p>
            </div>
        );
    }

    const viewW = Math.max(width, 260);
    const plotW = viewW - PAD_X * 2;
    const origin = first.startSeconds;
    const span = Math.max(1, last.startSeconds + last.durationSeconds - origin);
    const speedOf = (pace: number): number => (pace > 0 ? 1000 / pace : 0);
    const reps = session.reps;
    // Scale to the fastest trusted rep so a GPS glitch does not flatten every other bar.
    const maxSpeed = Math.max(
        0.1,
        ...segments.map((s, i) => (s.kind === "work" && !isTrusted(session, segments, i) ? 0 : speedOf(s.avgPaceSecondsPerKm))),
    );

    let repNumber = 0;
    return (
        <div className="trend-chart" ref={ref}>
            <svg viewBox={`0 0 ${viewW} ${HEIGHT}`} className="trend-chart__svg" style={{ height: HEIGHT }} role="img" aria-label={`Segments of the session: ${session.structure}`}>
                <line x1={PAD_X} y1={PAD_TOP + LANE_H} x2={viewW - PAD_X} y2={PAD_TOP + LANE_H} stroke="var(--chart-grid)" />
                {segments.map((seg, idx) => {
                    const x = PAD_X + ((seg.startSeconds - origin) / span) * plotW;
                    const w = Math.max(1, (seg.durationSeconds / span) * plotW - 1);
                    const trusted = seg.kind !== "work" || isTrusted(session, segments, idx);
                    const h = Math.max(MIN_BAR_H, Math.min(1, speedOf(seg.avgPaceSecondsPerKm) / maxSpeed) * LANE_H);
                    const y = PAD_TOP + LANE_H - h;
                    if (seg.kind === "work") repNumber++;
                    const rep = seg.kind === "work" ? reps[repNumber - 1] : undefined;
                    const label = rep?.label !== undefined && rep.label !== "" ? ` (${rep.label})` : "";
                    const title = `${seg.kind === "work" ? `Rep ${repNumber}${label}` : INTERVAL_KIND_LABELS[seg.kind]} · ${formatClock(seg.durationSeconds)} · ${formatPace(seg.avgPaceSecondsPerKm)}${seg.avgHeartRate > 0 ? ` · ${seg.avgHeartRate.toFixed(0)} bpm` : ""}${trusted ? "" : " · pace not trusted (GPS)"}`;
                    return (
                        <g key={`${seg.startSeconds}-${idx}`}>
                            <title>{title}</title>
                            <rect
                                x={x}
                                y={y}
                                width={w}
                                height={h}
                                rx={Math.min(3, w / 2)}
                                className={`session-strip__bar session-strip__bar--${seg.kind}${trusted ? "" : " is-untrusted"}`}
                            />
                            {seg.kind === "work" && w >= MIN_NUMBER_SLOT && (
                                <text x={x + w / 2} y={PAD_TOP + LANE_H + 14} fontSize="10" textAnchor="middle" fill="var(--chart-axis-text)">
                                    {repNumber}
                                </text>
                            )}
                        </g>
                    );
                })}
                <text x={PAD_X} y={HEIGHT - 4} fontSize="10" fill="var(--chart-axis-text)">
                    {formatClock(origin)}
                </text>
                <text x={viewW - PAD_X} y={HEIGHT - 4} fontSize="10" fill="var(--chart-axis-text)" textAnchor="end">
                    {formatClock(origin + span)}
                </text>
            </svg>
        </div>
    );
};

/** Whether the work segment at `index` maps to a rep whose pace is trusted. */
const isTrusted = (session: IntervalSession, segments: IntervalSession["segments"], index: number): boolean => {
    let rep = -1;
    for (let i = 0; i <= index; i++) {
        if (segments[i]?.kind === "work") rep++;
    }
    return session.reps[rep]?.plausible ?? true;
};
