import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { fetchActivityFiles, type ActivityFile } from "../activity/activity.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { addMonths, formatMonthLabel, groupActivitiesByDate } from "./calendar.utils";

export const CalendarPage = (): ReactElement => {
    const navigate = useNavigate();
    const today = useMemo(() => new Date(), []);
    const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [files, setFiles] = useState<ActivityFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        setIsLoading(true);
        setError(null);
        fetchActivityFiles()
            .then((res) => {
                if (!mounted) return;
                setFiles(res.files ?? []);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : "Could not load training activity.");
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const activitiesByDate = useMemo(() => groupActivitiesByDate(files), [files]);

    const goToPreviousMonth = () => setCursor((prev) => addMonths(prev.year, prev.month, -1));
    const goToNextMonth = () => setCursor((prev) => addMonths(prev.year, prev.month, 1));
    const goToToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() });

    const isEmpty = !isLoading && error === null && files.length === 0;

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Training log"
                title="Calendar"
                subtitle="A chronological view of every recorded training session."
                actions={
                    <div className="calendar__nav">
                        <button type="button" className="btn btn-sm" onClick={goToPreviousMonth} aria-label="Previous month">
                            ‹
                        </button>
                        <span className="calendar__title">{formatMonthLabel(cursor.year, cursor.month)}</span>
                        <button type="button" className="btn btn-sm" onClick={goToNextMonth} aria-label="Next month">
                            ›
                        </button>
                        <button type="button" className="btn btn-sm" onClick={goToToday}>
                            Today
                        </button>
                    </div>
                }
            />

            <Card>
                {isLoading && <LoadingState label="Loading training activity…" />}
                {!isLoading && error !== null && <ErrorState message={error} />}
                {isEmpty && (
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
                {!isLoading && error === null && files.length > 0 && (
                    <CalendarMonthGrid
                        year={cursor.year}
                        month={cursor.month}
                        activitiesByDate={activitiesByDate}
                        onSelectTraining={(id) => navigate(`/tracks/${id}`)}
                    />
                )}
            </Card>
        </section>
    );
};
