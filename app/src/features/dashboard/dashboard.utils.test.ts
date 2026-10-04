import { describe, expect, it } from "vitest";

import type { PaceHeartRatePoint } from "../activity/activity.service";
import { pickVisibleLabelIndices } from "./charts/chart-layout";
import { computeEfficiencyInsight, defaultRepDuration, deltaTrend, describeFade, describeVsBest, formatPercent, formatRatio, monthLabel, paceChange, round1, weekLabel } from "./dashboard.utils";

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
        expect(weekLabel("2026-09-07")).toBe("07/09");
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

describe("describeFade", () => {
    it("reports a faster last rep as a positive outcome", () => {
        expect(describeFade(-8.4)).toEqual({ label: "8% faster", tone: "positive" });
    });

    it("reports a slower last rep as a negative outcome", () => {
        expect(describeFade(5)).toEqual({ label: "5% slower", tone: "negative" });
    });

    it("treats tiny changes as even pacing and missing data as unknown", () => {
        expect(describeFade(0.4)).toEqual({ label: "Even", tone: "flat" });
        expect(describeFade(null)).toBeNull();
    });
});

describe("defaultRepDuration", () => {
    it("picks the rep length trained in the most sessions, the shorter one on ties", () => {
        expect(
            defaultRepDuration([
                { durationSeconds: 60, sessionCount: 9 },
                { durationSeconds: 120, sessionCount: 9 },
                { durationSeconds: 300, sessionCount: 4 },
            ]),
        ).toBe(60);
        expect(defaultRepDuration([])).toBeNull();
    });
});

describe("paceChange", () => {
    it("returns last minus first valid pace", () => {
        expect(paceChange([240, 0, 230, 225])).toBe(-15);
    });

    it("needs at least two valid paces", () => {
        expect(paceChange([240])).toBeNull();
    });
});

describe("formatRatio / formatPercent", () => {
    it("formats work:rest ratios and shares", () => {
        expect(formatRatio(1.5)).toBe("1.5 : 1");
        expect(formatRatio(0)).toBe("—");
        expect(formatPercent(0.114)).toBe("11%");
    });
});

describe("pickVisibleLabelIndices", () => {
    it("keeps every label when they fit", () => {
        expect([...pickVisibleLabelIndices(4, 400, 40)]).toEqual([0, 1, 2, 3]);
    });

    it("never places a stepped label right next to the forced last label", () => {
        const shown = [...pickVisibleLabelIndices(12, 200, 40)].sort((a, b) => a - b);
        expect(shown[0]).toBe(0);
        expect(shown[shown.length - 1]).toBe(11);
        for (let i = 1; i < shown.length; i++) {
            expect((shown[i] ?? 0) - (shown[i - 1] ?? 0)).toBeGreaterThanOrEqual(3);
        }
    });
});

describe("describeVsBest", () => {
    const prediction = (predictedSeconds: number, personalBestSeconds: number) => ({
        label: "5 km",
        distanceMeters: 5000,
        predictedSeconds,
        paceSecondsPerKm: predictedSeconds / 5,
        personalBestSeconds,
        isExtrapolated: false,
    });

    it("returns null without a personal best", () => {
        expect(describeVsBest(prediction(1200, 0))).toBeNull();
    });

    it("describes a prediction faster than the PB as positive", () => {
        expect(describeVsBest(prediction(1200, 1242))).toEqual({ label: "0:42 under PB", tone: "positive" });
    });

    it("describes a prediction slower than the PB as negative", () => {
        expect(describeVsBest(prediction(1265, 1200))).toEqual({ label: "1:05 over PB", tone: "negative" });
    });

    it("treats a sub-second difference as matching", () => {
        expect(describeVsBest(prediction(1200, 1200.4))).toEqual({ label: "Matches PB", tone: "flat" });
    });
});
