import { describe, expect, it } from "vitest";
import type { Series } from "./intervals";
import { analyzeRun } from "./runInsights";

const make = (speed: number[], hr: number[]): Series => {
    const cum = [0];
    for (const v of speed) cum.push((cum[cum.length - 1] ?? 0) + v);
    return { speed, hr, cum, duration: speed.length, totalMeters: cum[cum.length - 1] ?? 0 };
};

describe("analyzeRun", () => {
    it("excludes stops from moving pace", () => {
        const speed = [...Array(600).fill(3), ...Array(600).fill(0), ...Array(600).fill(3)];
        const r = analyzeRun(make(speed, Array(1800).fill(150)));
        expect(r?.movingSeconds).toBe(1200);
        expect(r?.movingPaceSecondsPerKm).toBeCloseTo(1000 / 3, 0);
        expect(r?.elapsedPaceSecondsPerKm).toBeGreaterThan(r?.movingPaceSecondsPerKm ?? 0);
    });

    it("detects fade and heart-rate drift", () => {
        const r = analyzeRun(make([...Array(900).fill(3.5), ...Array(900).fill(3)], [...Array(900).fill(140), ...Array(900).fill(154)]));
        expect(r?.negativeSplitIndex).toBeGreaterThan(1);
        expect(r?.hrDriftPercent).toBeGreaterThan(5); // halves split by distance, so they straddle the HR change
        expect(r?.splits.length).toBeGreaterThan(5);
    });

    it("assigns zone time from max heart rate", () => {
        const r = analyzeRun(make(Array(1000).fill(3), Array(1000).fill(120)));
        expect(r?.zones[1]?.seconds).toBe(1000); // 120 / 197 = 61% -> zone 2
    });

    it("returns null for too-short or empty series", () => {
        expect(analyzeRun(null)).toBeNull();
        expect(analyzeRun(make(Array(30).fill(3), []))).toBeNull();
    });
});
