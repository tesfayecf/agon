import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardStats, type ActivityFile } from "../activity/activity.service";

export const DashboardPage = (): ReactElement => {
    const [activities, setActivities] = useState<ActivityFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        fetchDashboardStats()
            .then((res) => { if (mounted) setActivities(res.recentActivities || []); })
            .catch(() => {})
            .finally(() => { if (mounted) setIsLoading(false); });
        return () => { mounted = false; };
    }, []);

    const totalDist = activities.reduce((acc, a) => acc + (a.distanceMeters || 0), 0) / 1000;
    const totalElev = activities.reduce((acc, a) => acc + (a.elevationGain || 0), 0);

    return (
        <section className="upload-grid" aria-live="polite">
            <article className="upload-panel" style={{ gridColumn: "span 12" }}>
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Dashboard</p>
                        <h2>Training Overview</h2>
                    </div>
                    <Link to="/tracks" className="button-link button-link--primary" style={{ textDecoration: "none", padding: "0.5rem 1rem" }}>Browse Tracks</Link>
                </div>

                <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Total Distance</span>
                        <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.5rem" }}>{totalDist.toFixed(2)} km</h3>
                    </article>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Total Elevation</span>
                        <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.5rem" }}>{totalElev.toFixed(0)} m</h3>
                    </article>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Workouts</span>
                        <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.5rem" }}>{activities.length}</h3>
                    </article>
                </div>
            </article>

            <article className="upload-list" style={{ gridColumn: "span 12", marginTop: "1rem" }}>
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Log</p>
                        <h3>Recent Trainings</h3>
                    </div>
                </div>
                {isLoading && <p className="panel__copy">Loading…</p>}
                {!isLoading && activities.length === 0 && <p className="panel__copy">No workouts recorded yet.</p>}
                {!isLoading && activities.length > 0 && (
                    <ul className="file-list">
                        {activities.slice(0, 6).map((act) => (
                            <li key={act.id}>
                                <Link to={`/tracks/${act.id}`} className="file-list__item" style={{ textDecoration: "none" }}>
                                    <div className="file-meta">
                                        <strong>{act.name || act.filename}</strong>
                                        <small>{act.activityDate ? new Date(act.activityDate).toLocaleDateString() : ""}</small>
                                    </div>
                                    <div>{act.distanceMeters && <strong>{(act.distanceMeters / 1000).toFixed(2)} km</strong>}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </article>
        </section>
    );
};
