import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchDashboardStats, type DashboardStats } from "../activity/activity.service";
import { fetchCalendarWeek } from "../schedule/schedule.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, ErrorState } from "../../shared/components/StateViews";
import { toDateKey } from "../calendar/calendar.utils";
import { OverviewTab, type WeeklyPlanSummary } from "./OverviewTab";
import { EnduranceTab } from "./EnduranceTab";
import { IntervalsTab } from "./IntervalsTab";
import { RacePredictorTab } from "./RacePredictorTab";

const TABS = [
    { id: "overview", label: "Overview", subtitle: "Your current load, long-term trends, and progress against the plan." },
    { id: "endurance", label: "Endurance", subtitle: "Continuous runs: distance, run length, and aerobic efficiency." },
    { id: "intervals", label: "Intervals", subtitle: "Labelled interval sessions: rep pace, quality volume, and pacing." },
    { id: "race", label: "Race predictor", subtitle: "Estimated race times from your recent runs, and how your fitness is trending." },
] as const;

type TabId = (typeof TABS)[number]["id"];

const isTabId = (value: string | null): value is TabId => TABS.some((t) => t.id === value);

export const DashboardPage = (): ReactElement => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [weekPlan, setWeekPlan] = useState<WeeklyPlanSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ overview: null, endurance: null, intervals: null, race: null });

    const requested = searchParams.get("tab");
    const activeTab: TabId = isTabId(requested) ? requested : "overview";
    const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

    const selectTab = (id: TabId): void => {
        setSearchParams(id === "overview" ? {} : { tab: id }, { replace: true });
    };

    // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern.
    const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
        const index = TABS.findIndex((t) => t.id === activeTab);
        let next = index;
        if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
        else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = TABS.length - 1;
        else return;
        e.preventDefault();
        const target = TABS[next];
        if (target === undefined) return;
        selectTab(target.id);
        tabRefs.current[target.id]?.focus();
    };

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

    return (
        <section aria-live="polite">
            <PageHeader title="Training Dashboard" subtitle={activeMeta.subtitle} />

            <div className="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        ref={(node) => {
                            tabRefs.current[tab.id] = node;
                        }}
                        type="button"
                        role="tab"
                        id={`dashboard-tab-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        aria-controls="dashboard-panel"
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        className={`dashboard-tab${activeTab === tab.id ? " is-active" : ""}`}
                        onClick={() => selectTab(tab.id)}
                        onKeyDown={onTabKeyDown}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

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
                <div className="dashboard-stack" role="tabpanel" id="dashboard-panel" aria-labelledby={`dashboard-tab-${activeTab}`}>
                    {activeTab === "overview" && <OverviewTab stats={stats} weekPlan={weekPlan} onGoalsChanged={load} />}
                    {activeTab === "endurance" && <EnduranceTab endurance={stats.endurance} />}
                    {activeTab === "intervals" && <IntervalsTab intervals={stats.intervals} />}
                    {activeTab === "race" && <RacePredictorTab predictor={stats.racePredictor} />}
                </div>
            )}
        </section>
    );
};
