import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import type { RacePredictor } from "../activity/activity.service";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { EmptyState } from "../../shared/components/StateViews";
import { formatDate, formatDistance, formatPace, formatTime } from "../../shared/utils/format";
import { LineTrendChart } from "./charts/LineTrendChart";
import { describeVsBest, weekLabel } from "./dashboard.utils";

interface RacePredictorTabProps {
    predictor: RacePredictor;
}

const METHOD_LABELS: Record<RacePredictor["method"], string> = {
    none: "—",
    best_effort: "Best effort",
    heart_rate: "Effort-adjusted",
};

/** Race-time predictions from recent runs using Daniels' VDOT model. */
export const RacePredictorTab = ({ predictor }: RacePredictorTabProps): ReactElement => {
    const windowLabel = `last ${predictor.windowWeeks} weeks`;

    if (predictor.method === "none" || predictor.basis === null) {
        return (
            <Card>
                <EmptyState
                    title="Not enough recent runs to predict race times"
                    message={`Upload a continuous run of at least 3 km from the ${windowLabel}. Interval sessions are not used, since their total pace mixes work and recovery.`}
                />
            </Card>
        );
    }

    const basis = predictor.basis;

    return (
        <>
            <div className="kpi-grid">
                <MetricCard label="Fitness (VDOT)" value={predictor.vdot.toFixed(1)} icon="◎" hint={METHOD_LABELS[predictor.method]} />
                <MetricCard
                    label="Runs analysed"
                    value={String(predictor.sampleCount)}
                    icon="≣"
                    hint={windowLabel}
                />
                <MetricCard
                    label="Best effort"
                    value={formatTime(basis.durationSeconds)}
                    icon="▲"
                    hint={`${formatDistance(basis.distanceMeters)} · ${formatDate(basis.date)}`}
                />
                <MetricCard
                    label="Longest run"
                    value={formatDistance(predictor.longestRunMeters)}
                    icon="◴"
                    hint={windowLabel}
                    isAvailable={predictor.longestRunMeters > 0}
                />
            </div>

            {!predictor.hasHeartRateProfile && (
                <p className="race-hint">
                    These predictions assume your best recent run was an all-out effort, so they are likely conservative.{" "}
                    <Link to="/settings">Add your resting and max heart rate</Link> to factor in how hard each run actually was.
                </p>
            )}

            <div className="dashboard-pair">
                <Card title="Predicted race times" eyebrow="Flat course, rested, race effort" accent="var(--chart-4)">
                    <ul className="pb-list">
                        {predictor.predictions.map((p) => {
                            const vsBest = describeVsBest(p);
                            return (
                                <li key={p.label} className="race-row">
                                    <span className="pb-row__meta">
                                        <strong>{p.label}</strong>
                                        <small>{formatPace(p.paceSecondsPerKm)}</small>
                                    </span>
                                    <span className="race-row__chips">
                                        {p.isExtrapolated && (
                                            <span
                                                className="chip chip--negative"
                                                title={`Much longer than your longest recent run (${formatDistance(predictor.longestRunMeters)}). Without the endurance, expect to be slower.`}
                                            >
                                                Endurance unproven
                                            </span>
                                        )}
                                        {vsBest !== null && (
                                            <span
                                                className={`chip${vsBest.tone === "flat" ? "" : ` chip--${vsBest.tone}`}`}
                                                title={`Personal best ${formatTime(p.personalBestSeconds)}`}
                                            >
                                                {vsBest.label}
                                            </span>
                                        )}
                                    </span>
                                    <span className="pb-row__time">{formatTime(p.predictedSeconds)}</span>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="race-footnote">
                        {predictor.method === "heart_rate"
                            ? "Each run's heart rate is used to estimate how hard it was, so easier runs count too. The best effort below sets the minimum."
                            : "Based on your fastest effort, assumed to be all-out:"}{" "}
                        <Link to={`/tracks/${basis.activityId}`}>{basis.activityName !== "" ? basis.activityName : "View run"}</Link> (VDOT{" "}
                        {basis.vdot.toFixed(1)}).
                    </p>
                </Card>

                <Card title="Fitness trend" eyebrow="VDOT estimate per week" accent="var(--chart-5)">
                    <LineTrendChart
                        points={predictor.trend.map((t) => ({
                            label: weekLabel(t.weekStart),
                            value: t.vdot,
                            tooltip: `Week of ${t.weekStart}: VDOT ${t.vdot.toFixed(1)} from ${t.runCount} run${t.runCount === 1 ? "" : "s"}`,
                        }))}
                        valueFormatter={(v) => v.toFixed(1)}
                        emptyMessage="No qualifying runs in the last 12 weeks."
                        color="var(--chart-5)"
                        ariaLabel="Weekly VDOT fitness estimate"
                    />
                    <p className="race-footnote">Higher is fitter. A week of only easy runs reads low unless your heart-rate profile is set.</p>
                </Card>
            </div>

            <p className="race-footnote">
                Predictions use Jack Daniels' VDOT model. They are estimates, not guarantees. Heat, hills, pacing and taper all move the result,
                and the marathon especially depends on long-run training.
            </p>
        </>
    );
};
