import { formatDayMonth, formatTime } from "../../shared/utils/format";
import type { MetricTrend } from "../../shared/components/MetricCard";
import type { PaceHeartRatePoint, RacePrediction } from "../activity/activity.service";

export const weekLabel = (weekStart: string): string => {
    return formatDayMonth(weekStart);
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

export type Tone = "positive" | "negative" | "flat";

/** Below this magnitude a rep-to-rep pace change is treated as even pacing. */
export const FADE_EVEN_THRESHOLD_PERCENT = 1;

/** Describes a session's fade (last vs. first rep, % slower) in words, e.g. "8% faster". */
export const describeFade = (fadePercent: number | null): { label: string; tone: Tone } | null => {
    if (fadePercent === null || !Number.isFinite(fadePercent)) return null;
    if (Math.abs(fadePercent) < FADE_EVEN_THRESHOLD_PERCENT) return { label: "Even", tone: "flat" };
    const amount = `${Math.abs(fadePercent).toFixed(0)}%`;
    return fadePercent < 0 ? { label: `${amount} faster`, tone: "positive" } : { label: `${amount} slower`, tone: "negative" };
};

/** The rep length shown first: the one trained in the most sessions, the shorter one on ties. */
export const defaultRepDuration = (series: { durationSeconds: number; sessionCount: number }[]): number | null => {
    let best: { durationSeconds: number; sessionCount: number } | null = null;
    for (const s of series) {
        if (best === null || s.sessionCount > best.sessionCount) best = s;
    }
    return best?.durationSeconds ?? null;
};

/** Change in pace between the first and last point, in seconds per km (negative = faster). */
export const paceChange = (paces: number[]): number | null => {
    const valid = paces.filter((p) => p > 0);
    const first = valid[0];
    const last = valid[valid.length - 1];
    if (valid.length < 2 || first === undefined || last === undefined) return null;
    return last - first;
};

export const formatRatio = (ratio: number): string => (ratio > 0 ? `${ratio.toFixed(1)} : 1` : "—");

export const formatPercent = (share: number): string => `${Math.round(share * 100)}%`;

/** How a prediction compares with the personal best, e.g. "0:42 under PB", or null when there is no PB. */
export const describeVsBest = (p: RacePrediction): { label: string; tone: Tone } | null => {
    if (p.personalBestSeconds <= 0) return null;
    const diff = p.personalBestSeconds - p.predictedSeconds;
    if (Math.abs(diff) < 1) return { label: "Matches PB", tone: "flat" };
    return diff > 0 ? { label: `${formatTime(diff)} under PB`, tone: "positive" } : { label: `${formatTime(-diff)} over PB`, tone: "negative" };
};
