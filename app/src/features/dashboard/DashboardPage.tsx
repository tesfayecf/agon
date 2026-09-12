import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";

import { fetchDashboardStats, type DashboardStats } from "../activity/activity.service";
import { fetchCalendarWeek } from "../schedule/schedule.service";
import { CalendarMiniPreview } from "../calendar/CalendarMiniPreview";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDistance, formatDuration, formatPace, formatTime } from "../../shared/utils/format";
import { GoalsPanel } from "../goals/GoalsPanel";
import { TrainingLoadCard } from "./TrainingLoadCard";
import { BarTrendChart } from "./charts/BarTrendChart";
import { LineTrendChart } from "./charts/LineTrendChart";
import { ScatterTrendChart } from "./charts/ScatterTrendChart";
import { toDateKey } from "../calendar/calendar.utils";
import { computeEfficiencyInsight, deltaTrend, EF_NOISE_THRESHOLD_PERCENT, monthLabel, round1, weekLabel } from "./dashboard.utils";

type VolumePeriod = "weekly" | "monthly";
type EffortMetric = "pace" | "heartRate";

interface WeeklyPlanSummary {
    plannedDistanceMeters: number;
    completedDistanceMeters: number;
}

export const DashboardPage = (): ReactElement => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [weekPlan, setWeekPlan] = useState<WeeklyPlanSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>("weekly");
    const [effortMetric, setEffortMetric] = useState<EffortMetric>("pace");

    const load = () => {
        setIsLoading(true);
        setError(null);
        Promise.all([fetchDashboardStats(), fetchCalendarWeek(toDateKey(new Date()))])
            .then(([dashboard, week]) => {
                setStats(dashboard);
                let planned = 0;
                let completed = 0;
                for (const day of week.days) {
                    for (const p of day.planned) {
                        planned += p.targetDistanceMeters ?? 0;
                    }
                    for (const c of day.completed) {
                        completed += c.distanceMeters ?? 0;
                    }
                }
                setWeekPlan({ plannedDistanceMeters: planned, completedDistanceMeters: completed });
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Could not load dashboard data.");
            })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const activities = stats?.recentActivities ?? [];

    const summary = useMemo(() => {
        if (stats === null) return null;
        const weekly = stats.weeklyTrend;
        const monthly = stats.monthlyTrend;
        const previousWeek = weekly.length >= 2 ? (weekly[weekly.length - 2]?.distanceMeters ?? 0) : 0;
        const previousMonth = monthly.length >= 2 ? (monthly[monthly.length - 2]?.distanceMeters ?? 0) : 0;
        const activeWeeks = weekly.filter((w) => w.distanceMeters > 0).length;
        const bestWeek = weekly.reduce((best, w) => (w.distanceMeters > best ? w.distanceMeters : best), 0);
        const avgSession = stats.trainingCount > 0 ? stats.totalDuration / stats.trainingCount : 0;
        const latestEffort = stats.paceHeartRatePoints[stats.paceHeartRatePoints.length - 1];
        const efficiencyInsight = computeEfficiencyInsight(stats.paceHeartRatePoints);
        return { previousWeek, previousMonth, activeWeeks, bestWeek, avgSession, latestEffort, efficiencyInsight, weeklyWindow: weekly.length };
    }, [stats]);

    const planProgress = useMemo(() => {
        if (weekPlan === null || weekPlan.plannedDistanceMeters <= 0) return null;
        return Math.min(100, (weekPlan.completedDistanceMeters / weekPlan.plannedDistanceMeters) * 100);
    }, [weekPlan]);

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Overview"
                title="Training Dashboard"
                subtitle="Your current load, long-term trends, and progress against the plan."
                actions={
                    <>
                        <Link to="/calendar" className="btn">
                            Plan the week
                        </Link>
                        <Link to="/tracks" className="btn btn-primary">
                            View all trainings
                        </Link>
                    </>
                }
            />

            {isLoading && (
                <Card>
                    <LoadingState label="Loading dashboard data…" />
                </Card>
            )}

            {!isLoading && error !== null && (
                <Card>
                    <ErrorState message={error} />
                </Card>
            )}

            {!isLoading && error === null && stats !== null && summary !== null && (
                <div className="dashboard-stack">
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

                            <Card
                                title="Fitness progress"
                                eyebrow="Pace vs. heart rate"
                                accent="var(--chart-5)"
                                actions={
                                    summary.latestEffort !== undefined ? (
                                        <div className="chip-row">
                                            <span className="chip">Latest {formatPace(summary.latestEffort.paceSecondsPerKm)}</span>
                                            <span className="chip">{summary.latestEffort.avgHeartRate.toFixed(0)} bpm</span>
                                            {summary.efficiencyInsight !== null && Math.abs(summary.efficiencyInsight.changePercent) >= EF_NOISE_THRESHOLD_PERCENT && (
                                                <span
                                                    className={`chip chip--${summary.efficiencyInsight.changePercent > 0 ? "positive" : "negative"}`}
                                                    title="Change in aerobic efficiency (speed per heartbeat) between the earlier and more recent half of these trainings"
                                                >
                                                    Efficiency {summary.efficiencyInsight.changePercent > 0 ? "▲" : "▼"}{" "}
                                                    {Math.abs(summary.efficiencyInsight.changePercent).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    ) : undefined
                                }
                            >
                                <p className="card__note">
                                    Each point is one training. A lower heart rate at a similar or faster pace over time suggests
                                    improving aerobic fitness.
                                </p>
                                <ScatterTrendChart
                                    points={stats.paceHeartRatePoints.map((p) => ({
                                        x: p.paceSecondsPerKm,
                                        y: p.avgHeartRate,
                                        tooltip: `${p.activityName || "Training"} · ${new Date(p.date).toLocaleDateString()} · ${formatPace(p.paceSecondsPerKm)} · ${p.avgHeartRate.toFixed(0)} bpm`,
                                    }))}
                                    xFormatter={(v) => formatPace(v)}
                                    yFormatter={(v) => `${v.toFixed(0)} bpm`}
                                    xLabel="Pace"
                                    yLabel="Heart rate"
                                    emptyMessage="Not enough trainings with both pace and heart-rate data yet."
                                />
                            </Card>

                            <Card title="Recent trainings" link={{ to: "/tracks", label: "See all" }}>
                                {activities.length === 0 && (
                                    <EmptyState
                                        title="No trainings recorded yet"
                                        message="Upload a FIT or TCX file from the sidebar to get started."
                                    />
                                )}
                                {activities.length > 0 && (
                                    <ul className="activity-list">
                                        {activities.slice(0, 6).map((act) => (
                                            <li key={act.id}>
                                                <Link to={`/tracks/${act.id}`} className="activity-row">
                                                    <span className="activity-row__marker" aria-hidden="true" />
                                                    <span className="activity-row__meta">
                                                        <strong>{act.name ?? act.filename}</strong>
                                                        <small>
                                                            {act.activityDate !== undefined && act.activityDate !== ""
                                                                ? new Date(act.activityDate).toLocaleDateString(undefined, {
                                                                      day: "numeric",
                                                                      month: "short",
                                                                      year: "numeric",
                                                                  })
                                                                : "Date unavailable"}
                                                            {act.tags !== undefined && act.tags !== "" ? ` · ${act.tags}` : ""}
                                                        </small>
                                                    </span>
                                                    <span className="activity-row__stats">
                                                        <strong>{formatDistance(act.distanceMeters)}</strong>
                                                        <small>{formatDuration(act.durationSeconds)}</small>
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>

                        <aside className="dashboard-grid__rail">
                            <Card title="Goals" accent="var(--accent)" link={{ to: "/schedule", label: "Schedule" }}>
                                <GoalsPanel goals={stats.goals ?? []} onChanged={load} />
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
                                                            {pb.date !== "" ? new Date(pb.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                                        </small>
                                                    </span>
                                                    <span className="pb-row__time">{formatTime(pb.bestSeconds)}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card title="This month" link={{ to: "/calendar", label: "Calendar" }}>
                                <CalendarMiniPreview files={activities} />
                            </Card>
                        </aside>
                    </div>
                </div>
            )}
        </section>
    );
};
