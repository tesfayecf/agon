import { describe, expect, it } from "vitest";

import type { ActivityFile } from "../activity/activity.service";
import { addMonths, formatMonthLabel, getMonthMatrix, groupActivitiesByDate, toDateKey } from "./calendar.utils";

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
