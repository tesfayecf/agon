import { distanceAt, timeAt, type Series } from "./intervals";

/** Observed maximum heart rate used for zones; raised automatically if an activity exceeds it. */
export const OBSERVED_MAX_HR = 197;
/** Below this speed (m/s, ~33:20/km) the runner counts as stopped. */
export const MOVING_SPEED = 0.5;
const MIN_PARTIAL_SPLIT_METERS = 100;

export interface Split {
    km: number;
    meters: number;
    elapsedSeconds: number;
    movingSeconds: number;
    /** Pace over moving time, s/km. */
    paceSecondsPerKm: number;
    avgHeartRate: number;
}

export interface HalfStats {
    paceSecondsPerKm: number;
    avgHeartRate: number;
}

export interface ZoneTime {
    zone: number;
    label: string;
    minBpm: number;
    maxBpm: number | null;
    seconds: number;
}

export interface RunInsights {
    elapsedSeconds: number;
    movingSeconds: number;
    totalMeters: number;
    movingPaceSecondsPerKm: number;
    elapsedPaceSecondsPerKm: number;
    splits: Split[];
    firstHalf: HalfStats;
    secondHalf: HalfStats;
    /** Second-half pace / first-half pace; below 1 is a negative split. */
    negativeSplitIndex: number;
    /** Percent the pace slowed in the second half (negative = sped up). */
    fadePercent: number;
    /** Percent heart rate rose from first to second half, or null without heart-rate data. */
    hrDriftPercent: number | null;
    maxHr: number;
    zones: ZoneTime[];
    hasHeartRate: boolean;
}

const ZONE_EDGES = [0.5, 0.6, 0.7, 0.8, 0.9] as const; // lower bound of zones 1..5 as a fraction of max HR
const ZONE_LABELS = ["Recovery", "Easy", "Aerobic", "Threshold", "Max"];

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

const range = (series: Series, from: number, to: number): { moving: number; hrSum: number; hrCount: number } => {
    let moving = 0;
    let hrSum = 0;
    let hrCount = 0;
    for (let i = Math.max(0, from); i < Math.min(series.duration, to); i++) {
        if ((series.speed[i] ?? 0) < MOVING_SPEED) continue;
        moving++;
        const h = series.hr[i] ?? 0;
        if (h > 0) {
            hrSum += h;
            hrCount++;
        }
    }
    return { moving, hrSum, hrCount };
};

const pace = (meters: number, seconds: number): number => (meters > 0 ? seconds / (meters / 1000) : 0);

export const analyzeRun = (series: Series | null): RunInsights | null => {
    if (series === null || series.totalMeters < 200) return null;

    const all = range(series, 0, series.duration);
    const movingSeconds = all.moving;
    if (movingSeconds === 0) return null;

    const splits: Split[] = [];
    const fullKm = Math.floor(series.totalMeters / 1000);
    const boundaries: number[] = [];
    for (let k = 1; k <= fullKm; k++) boundaries.push(k * 1000);
    if (series.totalMeters - fullKm * 1000 >= MIN_PARTIAL_SPLIT_METERS) boundaries.push(series.totalMeters);
    let prevMeters = 0;
    let prevT = 0;
    boundaries.forEach((end, idx) => {
        const t = end >= series.totalMeters ? series.duration : timeAt(series, end);
        const r = range(series, Math.floor(prevT), Math.ceil(t));
        const meters = end - prevMeters;
        splits.push({
            km: idx + 1,
            meters,
            elapsedSeconds: t - prevT,
            movingSeconds: r.moving,
            paceSecondsPerKm: pace(meters, r.moving),
            avgHeartRate: r.hrCount > 0 ? r.hrSum / r.hrCount : 0,
        });
        prevMeters = end;
        prevT = t;
    });

    const tHalf = Math.floor(timeAt(series, series.totalMeters / 2));
    const first = range(series, 0, tHalf);
    const second = range(series, tHalf, series.duration);
    const halfMeters = distanceAt(series, tHalf);
    const firstHalf: HalfStats = { paceSecondsPerKm: pace(halfMeters, first.moving), avgHeartRate: first.hrCount > 0 ? first.hrSum / first.hrCount : 0 };
    const secondHalf: HalfStats = { paceSecondsPerKm: pace(series.totalMeters - halfMeters, second.moving), avgHeartRate: second.hrCount > 0 ? second.hrSum / second.hrCount : 0 };
    const index = firstHalf.paceSecondsPerKm > 0 ? secondHalf.paceSecondsPerKm / firstHalf.paceSecondsPerKm : 1;
    const hasHeartRate = all.hrCount > 0;
    const drift = firstHalf.avgHeartRate > 0 && secondHalf.avgHeartRate > 0 ? ((secondHalf.avgHeartRate - firstHalf.avgHeartRate) / firstHalf.avgHeartRate) * 100 : null;

    const maxHr = Math.max(OBSERVED_MAX_HR, ...series.hr);
    const seconds = [0, 0, 0, 0, 0];
    if (hasHeartRate) {
        for (let i = 0; i < series.duration; i++) {
            const h = series.hr[i] ?? 0;
            if (h <= 0 || (series.speed[i] ?? 0) < MOVING_SPEED) continue;
            let z = 0;
            ZONE_EDGES.forEach((edge, idx) => {
                if (h >= edge * maxHr) z = idx;
            });
            seconds[z] = (seconds[z] ?? 0) + 1;
        }
    }
    const zones: ZoneTime[] = ZONE_EDGES.map((edge, idx) => ({
        zone: idx + 1,
        label: ZONE_LABELS[idx] ?? "",
        minBpm: Math.round(edge * maxHr),
        maxBpm: idx < ZONE_EDGES.length - 1 ? Math.round((ZONE_EDGES[idx + 1] ?? 1) * maxHr) - 1 : null,
        seconds: seconds[idx] ?? 0,
    }));

    return {
        elapsedSeconds: series.duration,
        movingSeconds,
        totalMeters: series.totalMeters,
        movingPaceSecondsPerKm: pace(series.totalMeters, movingSeconds),
        elapsedPaceSecondsPerKm: pace(series.totalMeters, series.duration),
        splits,
        firstHalf,
        secondHalf,
        negativeSplitIndex: index,
        fadePercent: (index - 1) * 100,
        hrDriftPercent: drift,
        maxHr,
        zones,
        hasHeartRate: sum(seconds) > 0,
    };
};
