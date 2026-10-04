import { describe, expect, it } from "vitest";

import type { ActivityRecord, WorkoutInterval } from "./activity.service";
import { buildSeries, findProblems, formatClock, paceProfile, parseClock, reorderIntervals, resolveInterval, sortByStart, summarizeWork, timeAt, toInput } from "./intervals";

// 300 s at 2.5 m/s (750 m), 120 s at 4 m/s (480 m), 60 s at 2 m/s, 120 s at 4 m/s.
const profile = (): ActivityRecord[] => {
    const phases: [number, number, number][] = [
        [300, 2.5, 140],
        [120, 4, 180],
        [60, 2, 150],
        [120, 4, 185],
    ];
    const start = Date.UTC(2026, 8, 29, 17, 0, 0);
    const records: ActivityRecord[] = [];
    let t = 0;
    for (const [seconds, speed, heartRate] of phases) {
        for (let i = 0; i < seconds; i++) {
            records.push({ timestamp: new Date(start + t * 1000).toISOString(), speed, heartRate });
            t++;
        }
    }
    return records;
};

const interval = (over: Partial<WorkoutInterval>): WorkoutInterval => ({ kind: "work", basis: "time", start: 0, length: 60, ...over });

describe("interval resolution", () => {
    const series = buildSeries(profile());

    it("builds a per-second series", () => {
        expect(series?.duration).toBe(600);
        expect(series?.totalMeters).toBeCloseTo(750 + 480 + 120 + 480, 5);
    });

    it("derives stats for a time-based interval", () => {
        const r = resolveInterval(series, interval({ start: 300, length: 120 }));
        expect(r.endSeconds).toBe(420);
        expect(r.distanceMeters).toBeCloseTo(480, 0);
        expect(r.avgPaceSecondsPerKm).toBeCloseTo(250, 0);
        expect(r.avgHeartRate).toBe(180);
        expect(r.startMeters).toBeCloseTo(750, 0);
    });

    it("derives the same range for a distance-based interval", () => {
        const r = resolveInterval(series, interval({ basis: "distance", start: 750, length: 480 }));
        expect(r.startSeconds).toBeCloseTo(300, 1);
        expect(r.endSeconds).toBeCloseTo(420, 1);
        expect(r.avgHeartRate).toBe(180);
    });

    it("interpolates inside a second", () => {
        // 1000 m is half-way through the first fast phase: 750 m + 4 m/s * 62.5 s
        expect(series === null ? 0 : timeAt(series, 1000)).toBeCloseTo(362.5, 1);
    });

    it("clamps to the end of the activity and zeroes intervals that start past it", () => {
        expect(resolveInterval(series, interval({ start: 480, length: 500 })).durationSeconds).toBe(120);
        expect(resolveInterval(series, interval({ start: 700, length: 60 })).durationSeconds).toBe(0);
        expect(resolveInterval(series, interval({ basis: "distance", start: 5000, length: 60 })).durationSeconds).toBe(0);
    });

    it("flags overlapping and out-of-range intervals", () => {
        const resolved = [
            resolveInterval(series, interval({ start: 300, length: 120 })),
            resolveInterval(series, interval({ basis: "distance", start: 1000, length: 100 })),
            resolveInterval(series, interval({ start: 900, length: 10 })),
            resolveInterval(series, interval({ start: 0, length: 60 })),
        ];
        const { overlapping, outOfRange } = findProblems(resolved);
        expect([...overlapping].sort()).toEqual([0, 1]);
        expect([...outOfRange]).toEqual([2]);
    });

    it("saves only the user's input", () => {
        const r = resolveInterval(series, interval({ start: 300, length: 120, label: "Rep 1" }));
        expect(toInput(r)).toEqual({ kind: "work", label: "Rep 1", basis: "time", start: 300, length: 120 });
    });

    it("summarizes the work reps", () => {
        const resolved = [resolveInterval(series, interval({ start: 300, length: 120 })), resolveInterval(series, interval({ start: 480, length: 120 }))];
        expect(summarizeWork(resolved)).toBe("2 × work · avg 2:00 · 4:10 /km · HR 183");
    });
});

describe("clock helpers", () => {
    it("formats and parses clock times", () => {
        expect(formatClock(75)).toBe("1:15");
        expect(formatClock(3725)).toBe("1:02:05");
        expect(parseClock("1:15")).toBe(75);
        expect(parseClock("90")).toBe(90);
        expect(parseClock("1:02:05")).toBe(3725);
        expect(parseClock("abc")).toBeNull();
        expect(parseClock("1:2:3:4")).toBeNull();
    });
});

describe("pace profile", () => {
    it("reports pace in seconds per km, interpolating the smoothing window", () => {
        const series = buildSeries(profile());
        const samples = series === null ? [] : paceProfile(series);
        const at = (t: number): number | null | undefined => samples.find((p) => p.t === t)?.v;
        // 4 m/s fast phase is 250 s/km; 2.5 m/s warm-up is 400 s/km; the window is odd-sized (15 s).
        expect(at(350)).toBeCloseTo(250, 0);
        expect(at(100)).toBeCloseTo(400, 0);
    });
});

describe("ordering", () => {
    const series = buildSeries(profile());
    const rep = (start: number, length: number, label: string): WorkoutInterval => interval({ start, length, label });

    it("sorts by start time", () => {
        const sorted = sortByStart(series, [rep(480, 60, "b"), rep(300, 60, "a")]);
        expect(sorted.map((iv) => iv.label)).toEqual(["a", "b"]);
    });

    it("reorders intervals, keeping lengths and the gaps between positions", () => {
        // A 0–60, gap 40, B 100–160, gap 40, C 200–300
        const resolved = [rep(0, 60, "A"), rep(100, 60, "B"), rep(200, 100, "C")].map((iv) => resolveInterval(series, iv));
        const moved = reorderIntervals(series, resolved, 2, 0);
        expect(moved.map((iv) => [iv.label, iv.start, iv.length])).toEqual([
            ["C", 0, 100],
            ["A", 140, 60],
            ["B", 240, 60],
        ]);
        const after = moved.map((iv) => resolveInterval(series, iv));
        expect(findProblems(after).overlapping.size).toBe(0);
    });

    it("is a no-op when dropped where it started", () => {
        const resolved = [rep(0, 60, "A"), rep(100, 60, "B")].map((iv) => resolveInterval(series, iv));
        expect(reorderIntervals(series, resolved, 1, 1)).toEqual(resolved.map(toInput));
    });

    it("keeps a distance-based interval's length in meters when it moves", () => {
        const resolved = [rep(0, 60, "A"), interval({ basis: "distance", start: 1000, length: 200, label: "B" })].map((iv) => resolveInterval(series, iv));
        const moved = reorderIntervals(series, resolved, 1, 0);
        expect(moved[0]).toMatchObject({ label: "B", basis: "distance", start: 0, length: 200 });
        expect(moved[1]?.label).toBe("A");
        expect(findProblems(moved.map((iv) => resolveInterval(series, iv))).overlapping.size).toBe(0);
    });
});
