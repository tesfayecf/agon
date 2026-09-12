import { describe, expect, it } from "vitest";

import type { PaceHeartRatePoint } from "../activity/activity.service";
import { computeEfficiencyInsight, deltaTrend, monthLabel, round1, weekLabel } from "./dashboard.utils";

const makePoint = (paceSecondsPerKm: number, avgHeartRate: number): PaceHeartRatePoint => ({
    date: "2026-01-01T00:00:00Z",
    paceSecondsPerKm,
    avgHeartRate,
    distanceMeters: 5000,
    activityId: "x",
    activityName: "Test run",
});

describe("weekLabel", () => {
    it("formats a week-start date key as a short day/month label", () => {
        expect(weekLabel("2026-09-07")).toContain("Sep");
        expect(weekLabel("2026-09-07")).toContain("7");
    });
});

describe("monthLabel", () => {
    it("formats a YYYY-MM key as a short month label", () => {
        expect(monthLabel("2026-03")).toContain("Mar");
    });

    it("falls back gracefully for a malformed key rather than throwing", () => {
        expect(() => monthLabel("not-a-month")).not.toThrow();
    });
});

describe("round1", () => {
    it("rounds to one decimal place", () => {
        expect(round1(1.2345)).toBe(1.2);
        expect(round1(1.25)).toBeCloseTo(1.3, 5);
    });
});

describe("deltaTrend", () => {
    it("is undefined when there is no previous value to compare against", () => {
        expect(deltaTrend(100, 0)).toBeUndefined();
    });

    it("reports 'up' when the current value increased", () => {
        const trend = deltaTrend(120, 100);
        expect(trend?.direction).toBe("up");
        expect(trend?.label).toContain("20%");
    });

    it("reports 'down' when the current value decreased", () => {
        const trend = deltaTrend(80, 100);
        expect(trend?.direction).toBe("down");
        expect(trend?.label).toContain("20%");
    });

    it("reports 'flat' for a negligible change", () => {
        const trend = deltaTrend(100.4, 100);
        expect(trend?.direction).toBe("flat");
    });

    it("passes through lowerIsBetter for the caller to interpret tone", () => {
        expect(deltaTrend(80, 100, true)?.lowerIsBetter).toBe(true);
    });
});

describe("computeEfficiencyInsight", () => {
    it("returns null with too few samples", () => {
        const points = [makePoint(300, 150), makePoint(300, 150)];
        expect(computeEfficiencyInsight(points)).toBeNull();
    });

    it("detects an improving trend (faster pace and/or lower heart rate over time)", () => {
        // Earlier half: slower pace, same HR. Recent half: faster pace, same HR -> EF rises.
        const points = [
            makePoint(320, 160),
            makePoint(320, 160),
            makePoint(320, 160),
            makePoint(290, 160),
            makePoint(290, 160),
            makePoint(290, 160),
        ];
        const insight = computeEfficiencyInsight(points);
        expect(insight).not.toBeNull();
        expect(insight?.changePercent).toBeGreaterThan(0);
    });

    it("detects a declining trend", () => {
        const points = [
            makePoint(290, 160),
            makePoint(290, 160),
            makePoint(290, 160),
            makePoint(320, 160),
            makePoint(320, 160),
            makePoint(320, 160),
        ];
        const insight = computeEfficiencyInsight(points);
        expect(insight?.changePercent).toBeLessThan(0);
    });

    it("reports ~0% change when pace and heart rate are both stable", () => {
        const points = Array.from({ length: 8 }, () => makePoint(300, 155));
        const insight = computeEfficiencyInsight(points);
        expect(insight?.changePercent).toBeCloseTo(0, 5);
    });
});
