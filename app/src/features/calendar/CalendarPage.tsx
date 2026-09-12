import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { fetchActivityFiles, type ActivityFile } from "../activity/activity.service";
import { fetchCalendarWeek, type CalendarWeekPayload } from "../schedule/schedule.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarWeekAgenda } from "./CalendarWeekAgenda";
import { CalendarYearHeatmap } from "./CalendarYearHeatmap";
import {
    addMonths,
    addWeeks,
    addYears,
    formatMonthLabel,
    formatWeekRangeLabel,
    getWeekStart,
    groupActivitiesByDate,
    toDateKey,
} from "./calendar.utils";

type ViewMode = "week" | "month" | "year";

export const CalendarPage = (): ReactElement => {
    const navigate = useNavigate();
    const today = useMemo(() => new Date(), []);
    const [view, setView] = useState<ViewMode>("week");

    // Week/agenda state (primary view)
    const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(today));
    const [weekData, setWeekData] = useState<CalendarWeekPayload | null>(null);
    const [isWeekLoading, setIsWeekLoading] = useState(true);
    const [weekError, setWeekError] = useState<string | null>(null);

    // Month/year views share the same full activity list, grouped by date.
    const [monthCursor, setMonthCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [yearCursor, setYearCursor] = useState(today.getFullYear());
    const [files, setFiles] = useState<ActivityFile[]>([]);
    const [isListLoading, setIsListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

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
        if (view !== "month" && view !== "year") return;
        let mounted = true;
        setIsListLoading(true);
        setListError(null);
        fetchActivityFiles()
            .then((res) => {
                if (mounted) setFiles(res.files ?? []);
            })
            .catch((err) => {
                if (mounted) setListError(err instanceof Error ? err.message : "Could not load training activity.");
            })
            .finally(() => {
                if (mounted) setIsListLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [view]);

    const activitiesByDate = useMemo(() => groupActivitiesByDate(files), [files]);

    const goToPreviousWeek = () => setWeekAnchor((prev) => addWeeks(prev, -1));
    const goToNextWeek = () => setWeekAnchor((prev) => addWeeks(prev, 1));
    const goToCurrentWeek = () => setWeekAnchor(getWeekStart(new Date()));

    const goToPreviousMonth = () => setMonthCursor((prev) => addMonths(prev.year, prev.month, -1));
    const goToNextMonth = () => setMonthCursor((prev) => addMonths(prev.year, prev.month, 1));
    const goToTodayMonth = () => setMonthCursor({ year: today.getFullYear(), month: today.getMonth() });

    const goToPreviousYear = () => setYearCursor((prev) => addYears(prev, -1));
    const goToNextYear = () => setYearCursor((prev) => addYears(prev, 1));
    const goToCurrentYear = () => setYearCursor(today.getFullYear());

    const jumpToWeekFor = (dateKey: string) => {
        const [y, m, d] = dateKey.split("-").map(Number);
        if (y === undefined || m === undefined || d === undefined) return;
        setWeekAnchor(getWeekStart(new Date(y, m - 1, d)));
        setView("week");
    };

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Training log"
                title="Calendar"
                subtitle="Plan the week ahead, browse a month, or see the whole year at a glance."
                actions={
                    <div className="calendar__nav">
                        <div className="view-toggle">
                            <button type="button" className={`btn btn-sm${view === "week" ? " is-active" : ""}`} onClick={() => setView("week")}>
                                Week
                            </button>
                            <button type="button" className={`btn btn-sm${view === "month" ? " is-active" : ""}`} onClick={() => setView("month")}>
                                Month
                            </button>
                            <button type="button" className={`btn btn-sm${view === "year" ? " is-active" : ""}`} onClick={() => setView("year")}>
                                Year
                            </button>
                        </div>
                        {view === "week" && (
                            <>
                                <button type="button" className="btn btn-sm" onClick={goToPreviousWeek} aria-label="Previous week">‹</button>
                                <span className="calendar__title">{formatWeekRangeLabel(weekAnchor)}</span>
                                <button type="button" className="btn btn-sm" onClick={goToNextWeek} aria-label="Next week">›</button>
                                <button type="button" className="btn btn-sm" onClick={goToCurrentWeek}>Today</button>
                            </>
                        )}
                        {view === "month" && (
                            <>
                                <button type="button" className="btn btn-sm" onClick={goToPreviousMonth} aria-label="Previous month">‹</button>
                                <span className="calendar__title">{formatMonthLabel(monthCursor.year, monthCursor.month)}</span>
                                <button type="button" className="btn btn-sm" onClick={goToNextMonth} aria-label="Next month">›</button>
                                <button type="button" className="btn btn-sm" onClick={goToTodayMonth}>Today</button>
                            </>
                        )}
                        {view === "year" && (
                            <>
                                <button type="button" className="btn btn-sm" onClick={goToPreviousYear} aria-label="Previous year">‹</button>
                                <span className="calendar__title">{yearCursor}</span>
                                <button type="button" className="btn btn-sm" onClick={goToNextYear} aria-label="Next year">›</button>
                                <button type="button" className="btn btn-sm" onClick={goToCurrentYear}>This year</button>
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
                    {isListLoading && <LoadingState label="Loading training activity…" />}
                    {!isListLoading && listError !== null && <ErrorState message={listError} />}
                    {!isListLoading && listError === null && files.length === 0 && (
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
                    {!isListLoading && listError === null && files.length > 0 && (
                        <CalendarMonthGrid
                            year={monthCursor.year}
                            month={monthCursor.month}
                            activitiesByDate={activitiesByDate}
                            onSelectTraining={(id) => navigate(`/tracks/${id}`)}
                        />
                    )}
                </Card>
            )}

            {view === "year" && (
                <Card>
                    {isListLoading && <LoadingState label="Loading training activity…" />}
                    {!isListLoading && listError !== null && <ErrorState message={listError} />}
                    {!isListLoading && listError === null && files.length === 0 && (
                        <EmptyState
                            title="No training activity recorded yet"
                            message="Upload a FIT or TCX file to see your yearly activity here."
                            action={
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/tracks")}>
                                    Go to Trainings
                                </button>
                            }
                        />
                    )}
                    {!isListLoading && listError === null && files.length > 0 && (
                        <CalendarYearHeatmap year={yearCursor} activitiesByDate={activitiesByDate} onSelectDay={jumpToWeekFor} />
                    )}
                </Card>
            )}
        </section>
    );
};
