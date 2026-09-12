import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";

import { fetchDashboardStats, type ActivityFile } from "../activity/activity.service";
import { CalendarMiniPreview } from "../calendar/CalendarMiniPreview";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDistance, formatDuration, formatElevation } from "../../shared/utils/format";

export const DashboardPage = (): ReactElement => {
    const [activities, setActivities] = useState<ActivityFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetchDashboardStats()
            .then((res) => {
                if (mounted) setActivities(res.recentActivities ?? []);
            })
            .catch((err) => {
                if (mounted) setError(err instanceof Error ? err.message : "Could not load dashboard data.");
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const totalDistance = activities.reduce((acc, a) => acc + (a.distanceMeters ?? 0), 0);
    const totalElevation = activities.reduce((acc, a) => acc + (a.elevationGain ?? 0), 0);
    const totalDuration = activities.reduce((acc, a) => acc + (a.durationSeconds ?? 0), 0);

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Overview"
                title="Training Dashboard"
                subtitle="A snapshot of your recorded running activity."
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

            {!isLoading && error === null && (
                <div className="card-grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)" }}>
                    <div>
                        <Card title="Current totals">
                            <div className="metric-grid">
                                <MetricCard label="Total distance" value={formatDistance(totalDistance)} isAvailable={totalDistance > 0} />
                                <MetricCard label="Total duration" value={formatDuration(totalDuration)} isAvailable={totalDuration > 0} />
                                <MetricCard label="Total elevation" value={formatElevation(totalElevation)} isAvailable={totalElevation > 0} />
                                <MetricCard label="Sessions" value={String(activities.length)} isAvailable={activities.length > 0} />
                            </div>
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

                    <Card title="This month" link={{ to: "/calendar", label: "Open calendar" }}>
                        <CalendarMiniPreview files={activities} />
                    </Card>
                </div>
            )}
        </section>
    );
};
