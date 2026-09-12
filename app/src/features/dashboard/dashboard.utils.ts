import type { MetricTrend } from "../../shared/components/MetricCard";
import type { PaceHeartRatePoint } from "../activity/activity.service";

export const weekLabel = (weekStart: string): string => {
    const d = new Date(`${weekStart}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const monthLabel = (month: string): string => {
    const parts = month.split("-").map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? 1;
    return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Builds a delta pill comparing the current period against the one before it. */
export const deltaTrend = (current: number, previous: number, lowerIsBetter = false): MetricTrend | undefined => {
    if (previous <= 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 1) return { direction: "flat", label: "level vs. previous", lowerIsBetter };
    return {
        direction: change > 0 ? "up" : "down",
        label: `${Math.abs(change).toFixed(0)}% vs. previous`,
        lowerIsBetter,
    };
};

/** Aerobic "efficiency factor": speed (m/min) per heartbeat. Higher is better —
 * more ground covered for the same cardiac effort. Comparing the average of
 * the most recent half of samples against the earlier half (rather than a
 * single session) smooths out day-to-day noise from terrain, weather, and
 * effort level, though it still can't fully separate "fitter" from "ran on
 * flatter ground" — presented as a directional trend, not a precise measure.
 */
export const efficiencyFactor = (p: PaceHeartRatePoint): number => 60000 / p.paceSecondsPerKm / p.avgHeartRate;

export const MIN_EF_SAMPLE = 6;
/** Below this magnitude of change, the movement is treated as noise rather than signal. */
export const EF_NOISE_THRESHOLD_PERCENT = 3;

export interface EfficiencyInsight {
    changePercent: number;
}

export const computeEfficiencyInsight = (points: PaceHeartRatePoint[]): EfficiencyInsight | null => {
    if (points.length < MIN_EF_SAMPLE) return null;
    const half = Math.floor(points.length / 2);
    const avgEf = (subset: PaceHeartRatePoint[]): number => subset.reduce((sum, p) => sum + efficiencyFactor(p), 0) / subset.length;
    const earlierAvg = avgEf(points.slice(0, half));
    const recentAvg = avgEf(points.slice(-half));
    if (earlierAvg <= 0) return null;
    return { changePercent: ((recentAvg - earlierAvg) / earlierAvg) * 100 };
};
