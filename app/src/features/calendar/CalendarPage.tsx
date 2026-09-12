import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { fetchActivityFiles, type ActivityFile } from "../activity/activity.service";
import { fetchCalendarWeek, type CalendarWeekPayload } from "../schedule/schedule.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarWeekAgenda } from "./CalendarWeekAgenda";
import { addMonths, addWeeks, formatMonthLabel, formatWeekRangeLabel, getWeekStart, groupActivitiesByDate, toDateKey } from "./calendar.utils";

type ViewMode = "week" | "month";

export const CalendarPage = (): ReactElement => {
    const navigate = useNavigate();
    const today = useMemo(() => new Date(), []);
    const [view, setView] = useState<ViewMode>("week");

    // Week/agenda state (primary view)
    const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(today));
    const [weekData, setWeekData] = useState<CalendarWeekPayload | null>(null);
    const [isWeekLoading, setIsWeekLoading] = useState(true);
    const [weekError, setWeekError] = useState<string | null>(null);

    // Month view state (secondary, preserved from the original implementation)
    const [monthCursor, setMonthCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [files, setFiles] = useState<ActivityFile[]>([]);
    const [isMonthLoading, setIsMonthLoading] = useState(true);
    const [monthError, setMonthError] = useState<string | null>(null);

    const loadWeek = () => {
        setIsWeekLoading(true);
        setWeekError(null);
        fetchCalendarWeek(toDateKey(weekAnchor))
            .then(setWeekData)
            .catch((err) => setWeekError(err instanceof Error ? err.message : "Could not load the weekly calendar."))
            .finally(() => setIsWeekLoading(false));
    };

    useEffect(() => {
        loadWeek();
        // loadWeek reads weekAnchor via closure; re-running it on other renders would refetch unnecessarily.
    }, [weekAnchor]);

    useEffect(() => {
        if (view !== "month") return;
        let mounted = true;
        setIsMonthLoading(true);
        setMonthError(null);
        fetchActivityFiles()
            .then((res) => {
                if (mounted) setFiles(res.files ?? []);
            })
            .catch((err) => {
                if (mounted) setMonthError(err instanceof Error ? err.message : "Could not load training activity.");
            })
            .finally(() => {
                if (mounted) setIsMonthLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [view, monthCursor]);

    const activitiesByDate = useMemo(() => groupActivitiesByDate(files), [files]);

    const goToPreviousWeek = () => setWeekAnchor((prev) => addWeeks(prev, -1));
    const goToNextWeek = () => setWeekAnchor((prev) => addWeeks(prev, 1));
    const goToCurrentWeek = () => setWeekAnchor(getWeekStart(new Date()));

    const goToPreviousMonth = () => setMonthCursor((prev) => addMonths(prev.year, prev.month, -1));
    const goToNextMonth = () => setMonthCursor((prev) => addMonths(prev.year, prev.month, 1));
    const goToTodayMonth = () => setMonthCursor({ year: today.getFullYear(), month: today.getMonth() });

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Training log"
                title="Calendar"
                subtitle="Plan the week ahead and see what you've already completed."
                actions={
                    <div className="calendar__nav">
                        <div className="view-toggle">
                            <button type="button" className={`btn btn-sm${view === "week" ? " is-active" : ""}`} onClick={() => setView("week")}>
                                Week
                            </button>
                            <button type="button" className={`btn btn-sm${view === "month" ? " is-active" : ""}`} onClick={() => setView("month")}>
                                Month
                            </button>
                        </div>
                        {view === "week" ? (
                            <>
                                <button type="button" className="btn btn-sm" onClick={goToPreviousWeek} aria-label="Previous week">‹</button>
                                <span className="calendar__title">{formatWeekRangeLabel(weekAnchor)}</span>
                                <button type="button" className="btn btn-sm" onClick={goToNextWeek} aria-label="Next week">›</button>
                                <button type="button" className="btn btn-sm" onClick={goToCurrentWeek}>Today</button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="btn btn-sm" onClick={goToPreviousMonth} aria-label="Previous month">‹</button>
                                <span className="calendar__title">{formatMonthLabel(monthCursor.year, monthCursor.month)}</span>
                                <button type="button" className="btn btn-sm" onClick={goToNextMonth} aria-label="Next month">›</button>
                                <button type="button" className="btn btn-sm" onClick={goToTodayMonth}>Today</button>
                            </>
                        )}
                    </div>
                }
            />

            {view === "week" && (
                <Card>
                    {isWeekLoading && <LoadingState label="Loading this week…" />}
                    {!isWeekLoading && weekError !== null && <ErrorState message={weekError} />}
                    {!isWeekLoading && weekError === null && weekData !== null && (
                        <CalendarWeekAgenda days={weekData.days} onSelectTraining={(id) => navigate(`/tracks/${id}`)} onChanged={loadWeek} />
                    )}
                </Card>
            )}

            {view === "month" && (
                <Card>
                    {isMonthLoading && <LoadingState label="Loading training activity…" />}
                    {!isMonthLoading && monthError !== null && <ErrorState message={monthError} />}
                    {!isMonthLoading && monthError === null && files.length === 0 && (
                        <EmptyState
                            title="No training activity recorded yet"
                            message="Upload a FIT or TCX file to see it appear on the calendar."
                            action={
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/tracks")}>
                                    Go to Trainings
                                </button>
                            }
                        />
                    )}
                    {!isMonthLoading && monthError === null && files.length > 0 && (
                        <CalendarMonthGrid
                            year={monthCursor.year}
                            month={monthCursor.month}
                            activitiesByDate={activitiesByDate}
                            onSelectTraining={(id) => navigate(`/tracks/${id}`)}
                        />
                    )}
                </Card>
            )}
        </section>
    );
};
