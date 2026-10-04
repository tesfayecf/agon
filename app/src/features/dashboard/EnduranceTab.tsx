import { useMemo, useState, type ReactElement } from "react";

import type { EnduranceAnalytics } from "../activity/activity.service";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { formatDate, formatDayMonth, formatDistance, formatDuration, formatElevation, formatHeartRate, formatPace } from "../../shared/utils/format";
import { BarTrendChart } from "./charts/BarTrendChart";
import { LineTrendChart } from "./charts/LineTrendChart";
import { ScatterTrendChart } from "./charts/ScatterTrendChart";
import { computeEfficiencyInsight, efficiencyFactor, EF_NOISE_THRESHOLD_PERCENT, round1, weekLabel } from "./dashboard.utils";

type WeeklyMetric = "distance" | "longest";
type FitnessView = "efficiency" | "scatter";

interface EnduranceTabProps {
    endurance: EnduranceAnalytics;
}

/** Every run that is not an interval session: volume, run length and aerobic efficiency. */
export const EnduranceTab = ({ endurance }: EnduranceTabProps): ReactElement => {
    const [weeklyMetric, setWeeklyMetric] = useState<WeeklyMetric>("distance");
    const [fitnessView, setFitnessView] = useState<FitnessView>("efficiency");
    const windowLabel = `last ${endurance.windowWeeks} weeks`;

    const efficiencyInsight = useMemo(() => computeEfficiencyInsight(endurance.efficiencyPoints), [endurance.efficiencyPoints]);
    const showInsight = efficiencyInsight !== null && Math.abs(efficiencyInsight.changePercent) >= EF_NOISE_THRESHOLD_PERCENT;

    return (
        <>
            <div className="kpi-grid">
                <MetricCard
                    label="Runs"
                    value={String(endurance.runCount)}
                    icon="≣"
                    hint={windowLabel}
                    isAvailable={endurance.runCount > 0}
                />
                <MetricCard
                    label="Distance"
                    value={formatDistance(endurance.totalDistanceMeters)}
                    icon="◴"
                    hint={`${formatDuration(endurance.totalDurationSeconds)} running`}
                    isAvailable={endurance.totalDistanceMeters > 0}
                />
                <MetricCard
                    label="Average run"
                    value={formatDistance(endurance.avgDistanceMeters)}
                    icon="◈"
                    hint={windowLabel}
                    isAvailable={endurance.avgDistanceMeters > 0}
                />
                <MetricCard
                    label="Longest run"
                    value={formatDistance(endurance.longestRun?.distanceMeters)}
                    icon="▲"
                    hint={endurance.longestRun !== null ? formatDate(endurance.longestRun.date) : windowLabel}
                    isAvailable={endurance.longestRun !== null}
                />
                <MetricCard
                    label="Average pace"
                    value={formatPace(endurance.avgPaceSecondsPerKm)}
                    icon="◷"
                    hint={endurance.avgHeartRate > 0 ? `avg. ${formatHeartRate(endurance.avgHeartRate)}` : windowLabel}
                    isAvailable={endurance.avgPaceSecondsPerKm > 0}
                />
                <MetricCard
                    label="Climbing"
                    value={formatElevation(endurance.elevationGainMeters)}
                    icon="⛰"
                    hint={windowLabel}
                    isAvailable={endurance.elevationGainMeters > 0}
                />
            </div>

            <div className="dashboard-pair">
                <Card
                    title={weeklyMetric === "distance" ? "Weekly distance" : "Longest run per week"}
                    eyebrow="Interval sessions excluded"
                    accent={weeklyMetric === "distance" ? "var(--chart-1)" : "var(--chart-4)"}
                    actions={
                        <div className="chart-tabs" role="tablist" aria-label="Weekly metric">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={weeklyMetric === "distance"}
                                className={`chart-tab${weeklyMetric === "distance" ? " is-active" : ""}`}
                                onClick={() => setWeeklyMetric("distance")}
                            >
                                Total
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={weeklyMetric === "longest"}
                                className={`chart-tab${weeklyMetric === "longest" ? " is-active" : ""}`}
                                onClick={() => setWeeklyMetric("longest")}
                            >
                                Longest
                            </button>
                        </div>
                    }
                >
                    <BarTrendChart
                        points={endurance.weekly.map((w) => ({
                            label: weekLabel(w.weekStart),
                            value: round1((weeklyMetric === "distance" ? w.distanceMeters : w.longestMeters) / 1000),
                            isCurrent: w.isCurrent,
                            tooltip:
                                weeklyMetric === "distance"
                                    ? `Week of ${w.weekStart}: ${formatDistance(w.distanceMeters)} over ${w.runCount} run${w.runCount === 1 ? "" : "s"}`
                                    : `Week of ${w.weekStart}: longest run ${formatDistance(w.longestMeters)}`,
                        }))}
                        valueFormatter={(v) => `${v} km`}
                        emptyMessage="No continuous runs in this period yet."
                        color={weeklyMetric === "distance" ? "var(--chart-1)" : "var(--chart-4)"}
                        ariaLabel={weeklyMetric === "distance" ? "Weekly distance of continuous runs" : "Longest run of each week"}
                    />
                </Card>

                <Card title="Run distances" eyebrow="All runs, by distance" accent="var(--chart-2)">
                    <BarTrendChart
                        points={endurance.distanceBands.map((b) => ({
                            label: b.label,
                            value: b.count,
                            tooltip: `${b.label}: ${b.count} run${b.count === 1 ? "" : "s"}`,
                        }))}
                        valueFormatter={(v) => String(Math.round(v))}
                        emptyMessage="No continuous runs recorded yet."
                        color="var(--chart-2)"
                        ariaLabel="Number of runs per distance band"
                        uniform
                    />
                </Card>
            </div>

            <Card
                title="Aerobic fitness"
                eyebrow={fitnessView === "efficiency" ? "Meters covered per heartbeat" : "Pace vs. heart rate"}
                accent="var(--chart-5)"
                actions={
                    <>
                        {showInsight && (
                            <span
                                className={`chip chip--${efficiencyInsight.changePercent > 0 ? "positive" : "negative"}`}
                                title="Change in efficiency between the earlier and the more recent half of these runs"
                            >
                                Efficiency {efficiencyInsight.changePercent > 0 ? "▲" : "▼"} {Math.abs(efficiencyInsight.changePercent).toFixed(0)}%
                            </span>
                        )}
                        <div className="chart-tabs" role="tablist" aria-label="Fitness view">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={fitnessView === "efficiency"}
                                className={`chart-tab${fitnessView === "efficiency" ? " is-active" : ""}`}
                                onClick={() => setFitnessView("efficiency")}
                            >
                                Efficiency
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={fitnessView === "scatter"}
                                className={`chart-tab${fitnessView === "scatter" ? " is-active" : ""}`}
                                onClick={() => setFitnessView("scatter")}
                            >
                                Pace vs. HR
                            </button>
                        </div>
                    </>
                }
            >
                {fitnessView === "efficiency" ? (
                    <>
                        <p className="card__note">
                            Each point is one run. More meters per heartbeat means more speed for the same cardiac effort; terrain
                            and heat move it too, so read the trend rather than single runs.
                        </p>
                        <LineTrendChart
                            points={endurance.efficiencyPoints.map((p) => ({
                                label: formatDayMonth(p.date),
                                value: Math.round(efficiencyFactor(p) * 100) / 100,
                                tooltip: `${p.activityName || "Training"} · ${formatDate(p.date)} · ${formatPace(p.paceSecondsPerKm)} · ${p.avgHeartRate.toFixed(0)} bpm`,
                            }))}
                            valueFormatter={(v) => `${v.toFixed(2)} m`}
                            emptyMessage="Not enough runs with both pace and heart-rate data yet."
                            color="var(--chart-5)"
                            ariaLabel="Meters covered per heartbeat, per run"
                        />
                    </>
                ) : (
                    <>
                        <p className="card__note">
                            Each point is one run. A lower heart rate at a similar or faster pace over time suggests improving
                            aerobic fitness.
                        </p>
                        <ScatterTrendChart
                            points={endurance.efficiencyPoints.map((p) => ({
                                x: p.paceSecondsPerKm,
                                y: p.avgHeartRate,
                                tooltip: `${p.activityName || "Training"} · ${formatDate(p.date)} · ${formatPace(p.paceSecondsPerKm)} · ${p.avgHeartRate.toFixed(0)} bpm`,
                            }))}
                            xFormatter={(v) => formatPace(v)}
                            yFormatter={(v) => `${v.toFixed(0)} bpm`}
                            xLabel="Pace"
                            yLabel="Heart rate"
                            emptyMessage="Not enough runs with both pace and heart-rate data yet."
                        />
                    </>
                )}
            </Card>
        </>
    );
};
