import { useMemo, type ReactElement } from "react";

import type { ActivityFile } from "../activity/activity.service";
import { formatDistance } from "../../shared/utils/format";
import { getYearMatrix, getWeekdayLabels } from "./calendar.utils";

interface CalendarYearHeatmapProps {
    year: number;
    activitiesByDate: Map<string, ActivityFile[]>;
    onSelectDay: (dateKey: string) => void;
}

interface DayTotal {
    distanceMeters: number;
    sessionCount: number;
}

const LEVEL_COUNT = 5; // 0 (none) .. 4 (highest volume)

const levelFor = (distance: number, maxDistance: number): number => {
    if (distance <= 0 || maxDistance <= 0) return 0;
    const ratio = distance / maxDistance;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
};

export const CalendarYearHeatmap = ({ year, activitiesByDate, onSelectDay }: CalendarYearHeatmapProps): ReactElement => {
    const weeks = useMemo(() => getYearMatrix(year), [year]);
    const weekdayLabels = getWeekdayLabels();

    const { totalsByKey, maxDistance, totalDistance, totalSessions } = useMemo(() => {
        const totals = new Map<string, DayTotal>();
        let max = 0;
        let distanceSum = 0;
        let sessionSum = 0;
        for (const week of weeks) {
            for (const day of week.days) {
                if (!day.isInYear) continue;
                const entries = activitiesByDate.get(day.key) ?? [];
                const distanceMeters = entries.reduce((sum, e) => sum + (e.distanceMeters ?? 0), 0);
                totals.set(day.key, { distanceMeters, sessionCount: entries.length });
                if (distanceMeters > max) max = distanceMeters;
                distanceSum += distanceMeters;
                sessionSum += entries.length;
            }
        }
        return { totalsByKey: totals, maxDistance: max, totalDistance: distanceSum, totalSessions: sessionSum };
    }, [weeks, activitiesByDate]);

    return (
        <div className="year-heatmap">
            <div className="year-heatmap__summary">
                <strong>{totalSessions}</strong> session{totalSessions === 1 ? "" : "s"} · <strong>{formatDistance(totalDistance)}</strong> in {year}
            </div>

            <div className="year-heatmap__scroll">
                <div className="year-heatmap__month-row">
                    <span className="year-heatmap__weekday-spacer" aria-hidden="true" />
                    {weeks.map((week, idx) => (
                        <span key={idx} className="year-heatmap__month-label">
                            {week.monthLabel ?? ""}
                        </span>
                    ))}
                </div>

                <div className="year-heatmap__main-row">
                    <div className="year-heatmap__weekdays">
                        {weekdayLabels.map((label, idx) => (
                            <span key={label} className="year-heatmap__weekday-label">
                                {idx % 2 === 1 ? label.slice(0, 3) : ""}
                            </span>
                        ))}
                    </div>

                    <div className="year-heatmap__grid">
                        {weeks.map((week, wIdx) => (
                            <div key={wIdx} className="year-heatmap__col">
                                {week.days.map((day) => {
                                    if (!day.isInYear) {
                                        return <span key={day.key} className="year-heatmap__cell year-heatmap__cell--empty" aria-hidden="true" />;
                                    }
                                    const totals = totalsByKey.get(day.key);
                                    const level = levelFor(totals?.distanceMeters ?? 0, maxDistance);
                                    const dateLabel = day.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                                    const detail =
                                        totals !== undefined && totals.sessionCount > 0
                                            ? `${formatDistance(totals.distanceMeters)} · ${totals.sessionCount} session${totals.sessionCount === 1 ? "" : "s"}`
                                            : "No training";
                                    return (
                                        <button
                                            key={day.key}
                                            type="button"
                                            className={`year-heatmap__cell year-heatmap__cell--level-${level}${day.isToday ? " year-heatmap__cell--today" : ""}`}
                                            title={`${dateLabel}: ${detail}`}
                                            aria-label={`${dateLabel}: ${detail}`}
                                            onClick={() => onSelectDay(day.key)}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="year-heatmap__legend">
                <span>Less</span>
                {Array.from({ length: LEVEL_COUNT }, (_, level) => (
                    <span key={level} className={`year-heatmap__cell year-heatmap__cell--level-${level}`} aria-hidden="true" />
                ))}
                <span>More</span>
            </div>
        </div>
    );
};
