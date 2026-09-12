import type { ReactElement } from "react";

import type { TrainingLoad, TrainingLoadStatus } from "../activity/activity.service";
import { EmptyState } from "../../shared/components/StateViews";
import { formatDistance } from "../../shared/utils/format";

// Gauge scale: the acute:chronic ratio is clamped to this range for the marker
// position (a ratio of, say, 3.0 from an extreme spike still just pins to the
// right edge rather than running off-scale).
const SCALE_MAX = 2.0;

const ZONES: { status: TrainingLoadStatus; label: string; from: number; to: number; color: string }[] = [
    { status: "low", label: "Low", from: 0, to: 0.8, color: "var(--chart-2)" },
    { status: "optimal", label: "Optimal", from: 0.8, to: 1.3, color: "var(--success)" },
    { status: "caution", label: "Caution", from: 1.3, to: 1.5, color: "var(--warning)" },
    { status: "high", label: "High", from: 1.5, to: SCALE_MAX, color: "var(--danger)" },
];

const HEADLINES: Record<TrainingLoadStatus, { title: string; body: string }> = {
    insufficient_data: {
        title: "Building your training-load picture",
        body: "Log a few more weeks of consistent training to unlock this insight.",
    },
    low: {
        title: "Recovery window",
        body: "Your recent volume is well below your typical month. If you're returning from a break, ease back in gradually rather than jumping straight to your old volume.",
    },
    optimal: {
        title: "Well balanced",
        body: "This week's volume sits within your normal training range — a sustainable place to keep building from.",
    },
    caution: {
        title: "Ramping up",
        body: "Your volume has increased noticeably versus your last month. Keep an eye on recovery over the next several days.",
    },
    high: {
        title: "Sharp increase",
        body: "Your volume has spiked well above your recent normal. Consider an easier week — sudden jumps in load are linked to higher injury risk.",
    },
};

interface TrainingLoadCardProps {
    load: TrainingLoad;
}

export const TrainingLoadCard = ({ load }: TrainingLoadCardProps): ReactElement => {
    if (!load.hasEnoughHistory) {
        return (
            <EmptyState title={HEADLINES.insufficient_data.title} message={HEADLINES.insufficient_data.body} />
        );
    }

    const headline = HEADLINES[load.status];
    const clampedRatio = Math.min(Math.max(load.ratio, 0), SCALE_MAX);
    // Keep the marker's own label (centered on the pin via translateX(-50%)) from
    // running past the gauge edges when the ratio sits at or beyond the scale ends.
    const markerPercent = Math.min(97, Math.max(3, (clampedRatio / SCALE_MAX) * 100));
    const activeZone = ZONES.find((z) => z.status === load.status) ?? ZONES[1];

    return (
        <div className="training-load">
            <p className="training-load__headline">
                <span className={`training-load__dot training-load__dot--${load.status}`} aria-hidden="true" />
                {/* One text node, not `<strong>` + a sibling text node, so the sentence
                    wraps as a single block instead of the bold lead-in getting its own
                    flex item and wrapping mid-phrase. */}
                <span>
                    <strong>{headline.title}.</strong> {headline.body}
                </span>
            </p>

            <div
                className="training-load__gauge"
                role="img"
                aria-label={`Acute to chronic training load ratio ${load.ratio.toFixed(2)}, status ${activeZone?.label ?? load.status}`}
            >
                <div className="training-load__zones">
                    {ZONES.map((zone) => (
                        <div
                            key={zone.status}
                            className="training-load__zone"
                            style={{ flexBasis: `${((zone.to - zone.from) / SCALE_MAX) * 100}%`, background: zone.color, opacity: zone.status === load.status ? 1 : 0.35 }}
                        />
                    ))}
                </div>
                <div className="training-load__marker" style={{ left: `${markerPercent}%` }}>
                    <span className="training-load__marker-value">{load.ratio.toFixed(2)}</span>
                    <span className="training-load__marker-pin" style={{ background: activeZone?.color }} />
                </div>
            </div>

            <div className="training-load__zone-labels">
                {ZONES.map((zone) => (
                    <span key={zone.status} style={{ flexBasis: `${((zone.to - zone.from) / SCALE_MAX) * 100}%` }}>
                        {zone.label}
                    </span>
                ))}
            </div>

            <div className="training-load__stats">
                <div>
                    <span className="training-load__stat-label">Last 7 days</span>
                    <strong>{formatDistance(load.acuteDistanceMeters)}</strong>
                </div>
                <div>
                    <span className="training-load__stat-label">Typical week (last month)</span>
                    <strong>{formatDistance(load.chronicWeeklyAvgMeters)}</strong>
                </div>
            </div>

            <p className="training-load__caveat">
                A simplified distance-based estimate of the acute:chronic workload ratio — a trend to watch, not a verdict.
                It doesn't account for training intensity, prior injury, sleep, or life stress.
            </p>
        </div>
    );
};
