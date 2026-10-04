import { useMemo, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";

import type { DashboardStats } from "../activity/activity.service";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { EmptyState } from "../../shared/components/StateViews";
import { formatDate, formatDistance, formatDuration, formatPace, formatTime } from "../../shared/utils/format";
import { GoalsPanel } from "../goals/GoalsPanel";
import { TrainingLoadCard } from "./TrainingLoadCard";
import { BarTrendChart } from "./charts/BarTrendChart";
import { LineTrendChart } from "./charts/LineTrendChart";
import { deltaTrend, monthLabel, round1, weekLabel } from "./dashboard.utils";

type VolumePeriod = "weekly" | "monthly";
type EffortMetric = "pace" | "heartRate";

export interface WeeklyPlanSummary {
    plannedDistanceMeters: number;
    completedDistanceMeters: number;
}

interface OverviewTabProps {
    stats: DashboardStats;
    weekPlan: WeeklyPlanSummary | null;
    onGoalsChanged: () => void;
}

/** General stats across every training: volume, load, effort, goals and records. */
export const OverviewTab = ({ stats, weekPlan, onGoalsChanged }: OverviewTabProps): ReactElement => {
    const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>("weekly");
    const [effortMetric, setEffortMetric] = useState<EffortMetric>("pace");

    const summary = useMemo(() => {
        const weekly = stats.weeklyTrend;
        const monthly = stats.monthlyTrend;
        const previousWeek = weekly.length >= 2 ? (weekly[weekly.length - 2]?.distanceMeters ?? 0) : 0;
        const previousMonth = monthly.length >= 2 ? (monthly[monthly.length - 2]?.distanceMeters ?? 0) : 0;
        const activeWeeks = weekly.filter((w) => w.distanceMeters > 0).length;
        const bestWeek = weekly.reduce((best, w) => (w.distanceMeters > best ? w.distanceMeters : best), 0);
        const avgSession = stats.trainingCount > 0 ? stats.totalDuration / stats.trainingCount : 0;
        return { previousWeek, previousMonth, activeWeeks, bestWeek, avgSession, weeklyWindow: weekly.length };
    }, [stats]);

    const planProgress = useMemo(() => {
        if (weekPlan === null || weekPlan.plannedDistanceMeters <= 0) return null;
        return Math.min(100, (weekPlan.completedDistanceMeters / weekPlan.plannedDistanceMeters) * 100);
    }, [weekPlan]);

    return (
        <>
            <div className="kpi-grid">
                <MetricCard
                    label="This week"
                    value={formatDistance(stats.currentWeekDistance)}
                    icon="◴"
                    hint={`${stats.currentWeekSessions} session${stats.currentWeekSessions === 1 ? "" : "s"}`}
                    trend={deltaTrend(stats.currentWeekDistance, summary.previousWeek)}
                    isAvailable={stats.currentWeekDistance > 0}
                />
                <MetricCard
                    label="This month"
                    value={formatDistance(stats.currentMonthDistance)}
                    icon="▤"
                    hint={`${stats.currentMonthSessions} session${stats.currentMonthSessions === 1 ? "" : "s"}`}
                    trend={deltaTrend(stats.currentMonthDistance, summary.previousMonth)}
                    isAvailable={stats.currentMonthDistance > 0}
                />
                <MetricCard
                    label="Consistency"
                    value={`${summary.activeWeeks}/${summary.weeklyWindow}`}
                    icon="◈"
                    hint="active weeks in window"
                    isAvailable={summary.activeWeeks > 0}
                />
                <MetricCard
                    label="Best week"
                    value={formatDistance(summary.bestWeek)}
                    icon="▲"
                    hint="highest weekly volume"
                    isAvailable={summary.bestWeek > 0}
                />
                <MetricCard
                    label="Sessions"
                    value={String(stats.trainingCount)}
                    icon="≣"
                    hint={`${formatDuration(summary.avgSession)} avg. session`}
                    isAvailable={stats.trainingCount > 0}
                />
                <MetricCard
                    label="Total time"
                    value={formatDuration(stats.totalDuration)}
                    icon="◷"
                    hint={`${formatDistance(stats.totalDistance)} all-time`}
                    isAvailable={stats.totalDuration > 0}
                />
            </div>

            <Card title="Training load" eyebrow="Acute (7-day) vs. chronic (28-day) volume" accent="var(--accent)">
                <TrainingLoadCard load={stats.trainingLoad} />
            </Card>

            <div className="dashboard-grid">
                <div className="dashboard-grid__main">
                    <Card
                        title="Training volume"
                        eyebrow="Completed training only"
                        accent={volumePeriod === "weekly" ? "var(--chart-1)" : "var(--chart-4)"}
                        actions={
                            <div className="chart-tabs" role="tablist" aria-label="Training volume period">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={volumePeriod === "weekly"}
                                    className={`chart-tab${volumePeriod === "weekly" ? " is-active" : ""}`}
                                    onClick={() => setVolumePeriod("weekly")}
                                >
                                    Weekly
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={volumePeriod === "monthly"}
                                    className={`chart-tab${volumePeriod === "monthly" ? " is-active" : ""}`}
                                    onClick={() => setVolumePeriod("monthly")}
                                >
                                    Monthly
                                </button>
                            </div>
                        }
                    >
                        {volumePeriod === "weekly" ? (
                            <BarTrendChart
                                points={stats.weeklyTrend.map((p) => ({
                                    label: weekLabel(p.weekStart),
                                    value: round1(p.distanceMeters / 1000),
                                    isCurrent: p.isCurrent,
                                    tooltip: `Week of ${p.weekStart}: ${formatDistance(p.distanceMeters)} (${p.sessionCount} sessions)`,
                                }))}
                                valueFormatter={(v) => `${v} km`}
                                emptyMessage="Not enough training data yet to show a weekly trend."
                                color="var(--chart-1)"
                                ariaLabel="Weekly training volume, most recent weeks"
                            />
                        ) : (
                            <BarTrendChart
                                points={stats.monthlyTrend.map((p) => ({
                                    label: monthLabel(p.month),
                                    value: round1(p.distanceMeters / 1000),
                                    isCurrent: p.isCurrent,
                                    tooltip: `${p.month}: ${formatDistance(p.distanceMeters)} (${p.sessionCount} sessions)`,
                                }))}
                                valueFormatter={(v) => `${v} km`}
                                emptyMessage="Not enough training data yet to show a monthly trend."
                                color="var(--chart-4)"
                                ariaLabel="Monthly training volume, most recent months"
                            />
                        )}
                    </Card>

                    <Card
                        title="Effort trend"
                        eyebrow="Weekly average"
                        accent={effortMetric === "pace" ? "var(--chart-2)" : "var(--chart-3)"}
                        actions={
                            <div className="chart-tabs" role="tablist" aria-label="Effort metric">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={effortMetric === "pace"}
                                    className={`chart-tab${effortMetric === "pace" ? " is-active" : ""}`}
                                    onClick={() => setEffortMetric("pace")}
                                >
                                    Pace
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={effortMetric === "heartRate"}
                                    className={`chart-tab${effortMetric === "heartRate" ? " is-active" : ""}`}
                                    onClick={() => setEffortMetric("heartRate")}
                                >
                                    Heart rate
                                </button>
                            </div>
                        }
                    >
                        {effortMetric === "pace" ? (
                            <LineTrendChart
                                points={stats.paceTrend.map((p) => ({
                                    label: weekLabel(p.weekStart),
                                    value: p.avgPaceSecondsPerKm,
                                    tooltip: `Week of ${p.weekStart}: ${formatPace(p.avgPaceSecondsPerKm)}`,
                                }))}
                                valueFormatter={(v) => formatPace(v)}
                                emptyMessage="No reliable pace data available yet."
                                color="var(--chart-2)"
                                ariaLabel="Weekly average pace trend"
                                invertY
                            />
                        ) : (
                            <LineTrendChart
                                points={stats.heartRateTrend.map((p) => ({
                                    label: weekLabel(p.weekStart),
                                    value: round1(p.avgHeartRate),
                                    tooltip: `Week of ${p.weekStart}: ${p.avgHeartRate.toFixed(0)} bpm`,
                                }))}
                                valueFormatter={(v) => `${v.toFixed(0)} bpm`}
                                emptyMessage="No heart-rate data recorded yet."
                                color="var(--chart-3)"
                                ariaLabel="Weekly average heart-rate trend"
                            />
                        )}
                    </Card>
                </div>

                <aside className="dashboard-grid__rail">
                    <Card title="Goals" accent="var(--accent)">
                        <GoalsPanel goals={stats.goals ?? []} onChanged={onGoalsChanged} />
                    </Card>

                    <Card title="This week" eyebrow="Planned vs. completed" accent="var(--chart-2)">
                        {weekPlan === null || (weekPlan.plannedDistanceMeters === 0 && weekPlan.completedDistanceMeters === 0) ? (
                            <EmptyState
                                title="Nothing planned yet"
                                message="Add planned sessions in the calendar to compare plan against reality."
                            />
                        ) : (
                            <div className="plan-compare">
                                <div className="plan-compare__row">
                                    <span className="plan-compare__label">Planned</span>
                                    <span className="plan-compare__value">{formatDistance(weekPlan.plannedDistanceMeters)}</span>
                                </div>
                                <div className="plan-compare__track">
                                    <div className="plan-compare__fill plan-compare__fill--planned" style={{ width: "100%" }} />
                                </div>
                                <div className="plan-compare__row">
                                    <span className="plan-compare__label">Completed</span>
                                    <span className="plan-compare__value">{formatDistance(weekPlan.completedDistanceMeters)}</span>
                                </div>
                                <div className="plan-compare__track">
                                    <div
                                        className="plan-compare__fill plan-compare__fill--completed"
                                        style={{ width: `${planProgress ?? 0}%` }}
                                    />
                                </div>
                                {planProgress !== null && (
                                    <p className="plan-compare__note">{planProgress.toFixed(0)}% of the planned week completed</p>
                                )}
                            </div>
                        )}
                    </Card>

                    <Card title="Personal bests" accent="var(--chart-4)">
                        {stats.personalBests.length === 0 && (
                            <EmptyState
                                title="No personal bests yet"
                                message="Complete a training matching a common race distance to see it here."
                            />
                        )}
                        {stats.personalBests.length > 0 && (
                            <ul className="pb-list">
                                {stats.personalBests.map((pb, idx) => (
                                    <li key={pb.label}>
                                        <Link to={`/tracks/${pb.activityId}`} className="pb-row">
                                            <span className={`pb-row__rank pb-row__rank--${Math.min(idx + 1, 4)}`} aria-hidden="true">
                                                {idx + 1}
                                            </span>
                                            <span className="pb-row__meta">
                                                <strong>{pb.label}</strong>
                                                <small>
                                                    {pb.date !== "" ? formatDate(pb.date) : "—"}
                                                </small>
                                            </span>
                                            <span className="pb-row__time">{formatTime(pb.bestSeconds)}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </aside>
            </div>
        </>
    );
};
