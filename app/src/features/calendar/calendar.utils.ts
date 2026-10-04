import { formatDate, formatDayMonth } from "../../shared/utils/format";
import type { ActivityFile } from "../activity/activity.service";

export interface CalendarDay {
    date: Date;
    key: string;
    isCurrentMonth: boolean;
    isToday: boolean;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const getWeekdayLabels = (): string[] => WEEKDAY_LABELS;

/** Formats a date as a local yyyy-mm-dd key, avoiding UTC-shift bugs from toISOString(). */
export const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const isSameDay = (a: Date, b: Date): boolean => toDateKey(a) === toDateKey(b);

/** Monday-first day-of-week index (0 = Monday .. 6 = Sunday). */
const mondayFirstIndex = (date: Date): number => (date.getDay() + 6) % 7;

/** Builds the 6x7 grid of days shown for the given month, including leading/trailing days. */
export const getMonthMatrix = (year: number, month: number, today: Date = new Date()): CalendarDay[] => {
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = mondayFirstIndex(firstOfMonth);
    const gridStart = new Date(year, month, 1 - startOffset);

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i += 1) {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        days.push({
            date,
            key: toDateKey(date),
            isCurrentMonth: date.getMonth() === month,
            isToday: isSameDay(date, today),
        });
    }
    return days;
};

export const formatMonthLabel = (year: number, month: number): string => {
    return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

/** Groups activity files by the local calendar date derived from their activityDate. */
export const groupActivitiesByDate = (files: ActivityFile[]): Map<string, ActivityFile[]> => {
    const grouped = new Map<string, ActivityFile[]>();
    for (const file of files) {
        if (file.activityDate === undefined || file.activityDate === "") continue;
        const date = new Date(file.activityDate);
        if (Number.isNaN(date.getTime())) continue;
        const key = toDateKey(date);
        const existing = grouped.get(key);
        if (existing) {
            existing.push(file);
        } else {
            grouped.set(key, [file]);
        }
    }
    return grouped;
};

export const addMonths = (year: number, month: number, delta: number): { year: number; month: number } => {
    const date = new Date(year, month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
};

/** Returns the Monday on/before the given date, as a local Date at midnight. */
export const getWeekStart = (date: Date): Date => {
    const offset = mondayFirstIndex(date);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
    return start;
};

export const addWeeks = (date: Date, delta: number): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta * 7);
};

/** Formats a Monday-starting week as "07/09 – 13/09/2026". */
export const formatWeekRangeLabel = (weekStart: Date): string => {
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    return `${formatDayMonth(weekStart)} – ${formatDate(weekEnd)}`;
};

export interface YearHeatmapDay {
    date: Date;
    key: string;
    isInYear: boolean;
    isToday: boolean;
}

export interface YearHeatmapWeek {
    days: YearHeatmapDay[];
    /** Set only on the first week column of a new month, for axis labels. */
    monthLabel?: string;
}

/**
 * Builds a GitHub-contributions-style week/day matrix covering an entire calendar year,
 * padded to full Monday-first weeks at both ends so every column has exactly 7 days.
 */
export const getYearMatrix = (year: number, today: Date = new Date()): YearHeatmapWeek[] => {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const gridStart = new Date(year, 0, 1 - mondayFirstIndex(jan1));
    const gridEnd = new Date(year, 11, 31 + (6 - mondayFirstIndex(dec31)));

    const weeks: YearHeatmapWeek[] = [];
    let lastLabeledMonth = -1;
    for (let cursor = gridStart; cursor <= gridEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)) {
        const days: YearHeatmapDay[] = [];
        let monthLabel: string | undefined;
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
            const isInYear = date.getFullYear() === year;
            days.push({ date, key: toDateKey(date), isInYear, isToday: isSameDay(date, today) });
            if (isInYear && date.getMonth() !== lastLabeledMonth && date.getDate() <= 7) {
                monthLabel = date.toLocaleDateString(undefined, { month: "short" });
                lastLabeledMonth = date.getMonth();
            }
        }
        weeks.push({ days, monthLabel });
    }
    return weeks;
};

export const addYears = (year: number, delta: number): number => year + delta;
