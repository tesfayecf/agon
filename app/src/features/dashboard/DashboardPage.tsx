import { useEffect, useState, type ReactElement } from "react";
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
import { BarTrendChart } from "./charts/BarTrendChart";
import { LineTrendChart } from "./charts/LineTrendChart";
import { ScatterTrendChart } from "./charts/ScatterTrendChart";
import { toDateKey } from "../calendar/calendar.utils";

const weekLabel = (weekStart: string): string => {
    const d = new Date(`${weekStart}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const monthLabel = (month: string): string => {
    const parts = month.split("-").map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? 1;
    return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

interface WeeklyPlanSummary {
    plannedDistanceMeters: number;
    completedDistanceMeters: number;
}

export const DashboardPage = (): ReactElement => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [weekPlan, setWeekPlan] = useState<WeeklyPlanSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Overview"
                title="Training Dashboard"
                subtitle="A snapshot of your current training state, trends, and goals."
                actions={
                    <Link to="/tracks" className="btn btn-primary">
                        View all trainings
                    </Link>
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

            {!isLoading && error === null && stats !== null && (
                <>
                    <div className="card-grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)" }}>
                        <div>
                            <Card title="Current state">
                                <div className="metric-grid">
                                    <MetricCard label="This week" value={formatDistance(stats.currentWeekDistance)} isAvailable={stats.currentWeekDistance > 0} />
                                    <MetricCard label="This month" value={formatDistance(stats.currentMonthDistance)} isAvailable={stats.currentMonthDistance > 0} />
                                    <MetricCard label="Completed sessions" value={String(stats.trainingCount)} isAvailable={stats.trainingCount > 0} />
                                    <MetricCard label="Total duration" value={formatDuration(stats.totalDuration)} isAvailable={stats.totalDuration > 0} />
                                </div>
                            </Card>

                            <Card title="Weekly mileage trend" eyebrow="Completed training only">
                                <BarTrendChart
                                    points={stats.weeklyTrend.map((p) => ({
                                        label: weekLabel(p.weekStart),
                                        value: round1(p.distanceMeters / 1000),
                                        isCurrent: p.isCurrent,
                                        tooltip: `Week of ${p.weekStart}: ${formatDistance(p.distanceMeters)} (${p.sessionCount} sessions)`,
                                    }))}
                                    valueFormatter={(v) => `${v} km`}
                                    emptyMessage="Not enough training data yet to show a weekly trend."
                                />
                            </Card>

                            <Card title="Monthly mileage trend" eyebrow="Completed training only">
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
                                />
                            </Card>

                            <div className="card-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                                <Card title="Pace trend" eyebrow="Weekly average">
                                    <LineTrendChart
                                        points={stats.paceTrend.map((p) => ({
                                            label: weekLabel(p.weekStart),
                                            value: p.avgPaceSecondsPerKm,
                                            tooltip: `Week of ${p.weekStart}: ${formatPace(p.avgPaceSecondsPerKm)}`,
                                        }))}
                                        valueFormatter={(v) => formatPace(v)}
                                        emptyMessage="No reliable pace data available yet."
                                        color="var(--chart-2)"
                                    />
                                </Card>

                                <Card title="Heart-rate trend" eyebrow="Weekly average">
                                    <LineTrendChart
                                        points={stats.heartRateTrend.map((p) => ({
                                            label: weekLabel(p.weekStart),
                                            value: round1(p.avgHeartRate),
                                            tooltip: `Week of ${p.weekStart}: ${p.avgHeartRate.toFixed(0)} bpm`,
                                        }))}
                                        valueFormatter={(v) => `${v.toFixed(0)} bpm`}
                                        emptyMessage="No heart-rate data recorded yet."
                                        color="var(--chart-3)"
                                    />
                                </Card>
                            </div>

                            <Card title="Fitness progress" eyebrow="Pace vs. heart rate, per training">
                                <p className="settings-field__description">
                                    Each point is one training. A lower heart rate at a similar (or faster) pace over
                                    time suggests improving aerobic fitness.
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

                            <Card title="Personal bests">
                                {stats.personalBests.length === 0 && (
                                    <EmptyState title="No personal bests yet" message="Complete a training that matches a common race distance to see it here." />
                                )}
                                {stats.personalBests.length > 0 && (
                                    <ul className="record-list">
                                        {stats.personalBests.map((pb) => (
                                            <li key={pb.label}>
                                                <Link to={`/tracks/${pb.activityId}`} className="record-list__item">
                                                    <div className="record-list__meta">
                                                        <strong>{pb.label}</strong>
                                                        <small>{pb.activityName || "—"} · {pb.date ? new Date(pb.date).toLocaleDateString() : "—"}</small>
                                                    </div>
                                                    <div className="record-list__stats">
                                                        <strong>{formatTime(pb.bestSeconds)}</strong>
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card title="Recent trainings" link={{ to: "/tracks", label: "See all" }}>
                                {activities.length === 0 && (
                                    <EmptyState
                                        title="No trainings recorded yet"
                                        message="Upload a FIT or TCX file from the sidebar to get started."
                                    />
                                )}
                                {activities.length > 0 && (
                                    <ul className="record-list">
                                        {activities.slice(0, 6).map((act) => (
                                            <li key={act.id}>
                                                <Link to={`/tracks/${act.id}`} className="record-list__item">
                                                    <div className="record-list__meta">
                                                        <strong>{act.name || act.filename}</strong>
                                                        <small>{act.activityDate ? new Date(act.activityDate).toLocaleDateString() : "Date unavailable"}</small>
                                                    </div>
                                                    <div className="record-list__stats">
                                                        {act.distanceMeters !== undefined && act.distanceMeters > 0 && (
                                                            <strong>{formatDistance(act.distanceMeters)}</strong>
                                                        )}
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>

                        <div>
                            <Card title="Goals" link={{ to: "/calendar", label: "Plan the week" }}>
                                <GoalsPanel goals={stats.goals ?? []} onChanged={load} />
                            </Card>

                            {weekPlan !== null && (weekPlan.plannedDistanceMeters > 0 || weekPlan.completedDistanceMeters > 0) && (
                                <Card title="This week: planned vs. completed">
                                    <div className="metric-grid">
                                        <MetricCard label="Planned" value={formatDistance(weekPlan.plannedDistanceMeters)} isAvailable={weekPlan.plannedDistanceMeters > 0} />
                                        <MetricCard label="Completed" value={formatDistance(weekPlan.completedDistanceMeters)} isAvailable={weekPlan.completedDistanceMeters > 0} />
                                    </div>
                                </Card>
                            )}

                            <Card title="This month" link={{ to: "/calendar", label: "Open calendar" }}>
                                <CalendarMiniPreview files={activities} />
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
};

const round1 = (value: number): number => Math.round(value * 10) / 10;
