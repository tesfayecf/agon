import { describe, expect, it } from "vitest";

import type { ActivityFile } from "../activity/activity.service";
import {
    addMonths,
    addWeeks,
    addYears,
    formatMonthLabel,
    formatWeekRangeLabel,
    getMonthMatrix,
    getWeekStart,
    getYearMatrix,
    groupActivitiesByDate,
    toDateKey,
} from "./calendar.utils";

const makeFile = (id: string, activityDate?: string): ActivityFile => ({
    id,
    filename: `${id}.fit`,
    fileType: "FIT",
    activityDate,
    recordCount: 0,
    status: "success",
});

describe("toDateKey", () => {
    it("formats the local date as yyyy-mm-dd", () => {
        expect(toDateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
        expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
    });
});

describe("getMonthMatrix", () => {
    it("always returns a 6x7 grid of days", () => {
        const days = getMonthMatrix(2026, 0);
        expect(days).toHaveLength(42);
    });

    it("marks days outside the requested month", () => {
        const days = getMonthMatrix(2026, 1); // February 2026
        const currentMonthDays = days.filter((d) => d.isCurrentMonth);
        expect(currentMonthDays).toHaveLength(28);
    });

    it("marks today's date", () => {
        const today = new Date(2026, 5, 15);
        const days = getMonthMatrix(2026, 5, today);
        const marked = days.filter((d) => d.isToday);
        expect(marked).toHaveLength(1);
        expect(marked[0]?.key).toBe("2026-06-15");
    });
});

describe("addMonths", () => {
    it("wraps around year boundaries", () => {
        expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
        expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    });
});

describe("formatMonthLabel", () => {
    it("renders a human readable month and year", () => {
        expect(formatMonthLabel(2026, 0)).toContain("2026");
    });
});

describe("groupActivitiesByDate", () => {
    it("associates a training with the local calendar date derived from its activityDate", () => {
        const files = [makeFile("a", "2026-03-05T12:00:00Z"), makeFile("b", "2026-03-05T13:00:00Z"), makeFile("c", "2026-03-06T12:00:00Z")];
        const grouped = groupActivitiesByDate(files);
        expect(grouped.get("2026-03-05")).toHaveLength(2);
        expect(grouped.get("2026-03-06")).toHaveLength(1);
    });

    it("ignores files without a usable activity date", () => {
        const files = [makeFile("a", undefined), makeFile("b", ""), makeFile("c", "not-a-date")];
        const grouped = groupActivitiesByDate(files);
        expect(grouped.size).toBe(0);
    });
});

describe("getWeekStart", () => {
    it("returns the Monday on/before the given date", () => {
        // Saturday 2026-09-12 -> Monday 2026-09-07
        expect(toDateKey(getWeekStart(new Date(2026, 8, 12)))).toBe("2026-09-07");
    });

    it("returns the same date when it is already a Monday", () => {
        expect(toDateKey(getWeekStart(new Date(2026, 8, 7)))).toBe("2026-09-07");
    });

    it("handles Sunday as the last day of the week", () => {
        expect(toDateKey(getWeekStart(new Date(2026, 8, 13)))).toBe("2026-09-07");
    });
});

describe("addWeeks", () => {
    it("shifts a date forward and backward by whole weeks", () => {
        const base = new Date(2026, 8, 7);
        expect(toDateKey(addWeeks(base, 1))).toBe("2026-09-14");
        expect(toDateKey(addWeeks(base, -1))).toBe("2026-08-31");
    });
});

describe("formatWeekRangeLabel", () => {
    it("renders a human readable week range", () => {
        const label = formatWeekRangeLabel(new Date(2026, 8, 7));
        expect(label).toContain("2026");
        expect(label).toContain("–");
    });
});

describe("getYearMatrix", () => {
    it("pads to full Monday-first weeks and covers every day of the year exactly once", () => {
        const weeks = getYearMatrix(2026);
        const inYearDays = weeks.flatMap((w) => w.days).filter((d) => d.isInYear);
        expect(inYearDays).toHaveLength(365); // 2026 is not a leap year

        const keys = new Set(inYearDays.map((d) => d.key));
        expect(keys.has("2026-01-01")).toBe(true);
        expect(keys.has("2026-12-31")).toBe(true);
        expect(keys.size).toBe(365);
    });

    it("every week has exactly 7 days and starts on a Monday", () => {
        const weeks = getYearMatrix(2026);
        for (const week of weeks) {
            expect(week.days).toHaveLength(7);
            const first = week.days[0];
            expect(first?.date.getDay()).toBe(1); // Monday
        }
    });

    it("marks today within the year", () => {
        const today = new Date(2026, 5, 15);
        const weeks = getYearMatrix(2026, today);
        const marked = weeks.flatMap((w) => w.days).filter((d) => d.isToday);
        expect(marked).toHaveLength(1);
        expect(marked[0]?.key).toBe("2026-06-15");
    });

    it("labels the first in-year week of each month exactly once", () => {
        const weeks = getYearMatrix(2026);
        const labels = weeks.map((w) => w.monthLabel).filter((label): label is string => label !== undefined);
        expect(labels).toHaveLength(12);
    });
});

describe("addYears", () => {
    it("shifts the year by the given delta", () => {
        expect(addYears(2026, 1)).toBe(2027);
        expect(addYears(2026, -1)).toBe(2025);
    });
});
