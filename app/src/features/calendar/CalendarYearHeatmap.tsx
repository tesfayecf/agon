import { useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";

import type { ActivityFile } from "../activity/activity.service";
import { formatDistance } from "../../shared/utils/format";
import { getYearMatrix, getWeekdayLabels, toDateKey, type YearHeatmapWeek } from "./calendar.utils";

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

/** Finds the first in-year cell's [week, day] position, searching forward from a start point. */
const firstInYearPosition = (weeks: YearHeatmapWeek[]): [number, number] => {
    for (let w = 0; w < weeks.length; w += 1) {
        for (let d = 0; d < 7; d += 1) {
            if (weeks[w]?.days[d]?.isInYear) return [w, d];
        }
    }
    return [0, 0];
};

const lastInYearPosition = (weeks: YearHeatmapWeek[]): [number, number] => {
    for (let w = weeks.length - 1; w >= 0; w -= 1) {
        for (let d = 6; d >= 0; d -= 1) {
            if (weeks[w]?.days[d]?.isInYear) return [w, d];
        }
    }
    return [0, 0];
};

export const CalendarYearHeatmap = ({ year, activitiesByDate, onSelectDay }: CalendarYearHeatmapProps): ReactElement => {
    const weeks = useMemo(() => getYearMatrix(year), [year]);
    const weekdayLabels = getWeekdayLabels();
    const cellRefs = useRef(new Map<string, HTMLButtonElement>());

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

    // Roving tabindex: only one cell is a Tab stop at a time (otherwise a year is 365+
    // separate stops); arrow keys move focus within the grid instead. Defaults to today
    // when it falls in the displayed year, so opening "this year" lands somewhere useful.
    const [activeKey, setActiveKey] = useState<string>(() => {
        const todayKey = toDateKey(new Date());
        for (const week of weeks) {
            if (week.days.some((d) => d.isInYear && d.key === todayKey)) return todayKey;
        }
        const [w, d] = firstInYearPosition(weeks);
        return weeks[w]?.days[d]?.key ?? "";
    });

    const focusCell = (key: string): void => {
        setActiveKey(key);
        cellRefs.current.get(key)?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, weekIndex: number, dayIndex: number): void => {
        let targetWeek = weekIndex;
        let targetDay = dayIndex;

        switch (e.key) {
            case "ArrowRight":
            case "ArrowLeft": {
                const step = e.key === "ArrowRight" ? 1 : -1;
                let w = weekIndex + step;
                while (w >= 0 && w < weeks.length && !weeks[w]?.days[dayIndex]?.isInYear) w += step;
                if (w < 0 || w >= weeks.length) return;
                targetWeek = w;
                break;
            }
            case "ArrowDown":
            case "ArrowUp": {
                const step = e.key === "ArrowDown" ? 1 : -1;
                const d = dayIndex + step;
                if (d < 0 || d > 6 || !weeks[weekIndex]?.days[d]?.isInYear) return;
                targetDay = d;
                break;
            }
            case "Home": {
                const [w, d] = firstInYearPosition(weeks);
                targetWeek = w;
                targetDay = d;
                break;
            }
            case "End": {
                const [w, d] = lastInYearPosition(weeks);
                targetWeek = w;
                targetDay = d;
                break;
            }
            default:
                return;
        }

        e.preventDefault();
        const targetKey = weeks[targetWeek]?.days[targetDay]?.key;
        if (targetKey !== undefined) focusCell(targetKey);
    };

    return (
        <div className="year-heatmap">
            <div className="year-heatmap__summary">
                <strong>{totalSessions}</strong> session{totalSessions === 1 ? "" : "s"} · <strong>{formatDistance(totalDistance)}</strong> in {year}
            </div>

            <div className="year-heatmap__scroll">
                <div className="year-heatmap__month-row" aria-hidden="true">
                    <span className="year-heatmap__weekday-spacer" />
                    {weeks.map((week, idx) => (
                        <span key={idx} className="year-heatmap__month-label">
                            {week.monthLabel ?? ""}
                        </span>
                    ))}
                </div>

                <div
                    className="year-heatmap__main-row"
                    role="group"
                    aria-label={`Daily training activity heatmap for ${year}. Use arrow keys to move between days.`}
                >
                    <div className="year-heatmap__weekdays" aria-hidden="true">
                        {weekdayLabels.map((label, idx) => (
                            <span key={label} className="year-heatmap__weekday-label">
                                {idx % 2 === 1 ? label.slice(0, 3) : ""}
                            </span>
                        ))}
                    </div>

                    <div className="year-heatmap__grid">
                        {weeks.map((week, wIdx) => (
                            <div key={wIdx} className="year-heatmap__col">
                                {week.days.map((day, dIdx) => {
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
                                            ref={(el) => {
                                                if (el) cellRefs.current.set(day.key, el);
                                                else cellRefs.current.delete(day.key);
                                            }}
                                            type="button"
                                            tabIndex={day.key === activeKey ? 0 : -1}
                                            className={`year-heatmap__cell year-heatmap__cell--level-${level}${day.isToday ? " year-heatmap__cell--today" : ""}`}
                                            title={`${dateLabel}: ${detail}`}
                                            aria-label={`${dateLabel}: ${detail}`}
                                            onFocus={() => setActiveKey(day.key)}
                                            onKeyDown={(e) => handleKeyDown(e, wIdx, dIdx)}
                                            onClick={() => onSelectDay(day.key)}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="year-heatmap__legend" aria-hidden="true">
                <span>Less</span>
                {Array.from({ length: LEVEL_COUNT }, (_, level) => (
                    <span key={level} className={`year-heatmap__cell year-heatmap__cell--level-${level}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
};
