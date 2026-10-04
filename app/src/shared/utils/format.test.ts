import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatDayMonth } from "./format";

describe("date formatting", () => {
    it("formats dates as DD/MM/YYYY", () => {
        expect(formatDate(new Date(2026, 9, 3))).toBe("03/10/2026");
        expect(formatDate(new Date(2026, 0, 31))).toBe("31/01/2026");
    });

    it("treats date-only strings as local calendar days", () => {
        expect(formatDate("2026-10-06")).toBe("06/10/2026");
        expect(formatDayMonth("2026-10-06")).toBe("06/10");
    });

    it("formats timestamps with a 24-hour time", () => {
        expect(formatDateTime(new Date(2026, 9, 3, 7, 5))).toBe("03/10/2026 07:05");
        expect(formatDateTime(new Date(2026, 9, 3, 19, 30))).toBe("03/10/2026 19:30");
    });

    it("shows a dash for missing or invalid values", () => {
        expect(formatDate(undefined)).toBe("—");
        expect(formatDate("")).toBe("—");
        expect(formatDate("not a date")).toBe("—");
        expect(formatDateTime("nope")).toBe("—");
    });
});
