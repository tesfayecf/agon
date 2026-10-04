import type { ActivityRecord, IntervalKind, WorkoutInterval, WorkoutType } from "./activity.service";

/** Shared horizontal SVG layout so the interval timeline lines up with the time series chart above it. */
export const CHART_PAD_X = 46;
export const CHART_PAD_R = 12;

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    "": "Not set",
    easy: "Easy run",
    long: "Long run",
    tempo: "Tempo",
    hills: "Hilly run",
    intervals: "Intervals",
    race: "Race",
    other: "Other",
};

export const INTERVAL_KIND_LABELS: Record<IntervalKind, string> = {
    warmup: "Warm-up",
    work: "Work",
    recovery: "Recovery",
    cooldown: "Cool-down",
};

/** Per-second resampling of an activity, with elapsed time measured from its first record. Mirrors the server. */
export interface Series {
    speed: number[]; // m/s, forward-filled
    hr: number[]; // bpm, forward-filled, 0 when unknown
    cum: number[]; // meters covered before each second; length is speed.length + 1
    duration: number; // seconds
    totalMeters: number;
}

const MAX_PLAUSIBLE_SPEED = 10; // m/s; faster is a GPS glitch
const MAX_SECONDS = 7 * 24 * 3600;

export const elapsedSeconds = (records: ActivityRecord[]): { t: number; rec: ActivityRecord }[] => {
    const out: { t: number; rec: ActivityRecord }[] = [];
    let t0: number | null = null;
    for (const rec of records) {
        if (!rec.timestamp) continue;
        const ms = Date.parse(rec.timestamp);
        if (Number.isNaN(ms)) continue;
        t0 ??= ms;
        out.push({ t: Math.trunc((ms - t0) / 1000), rec });
    }
    return out;
};

export const buildSeries = (records: ActivityRecord[]): Series | null => {
    const samples = elapsedSeconds(records);
    const last = samples[samples.length - 1];
    if (last === undefined) return null;
    const n = last.t + 1;
    if (n <= 1 || n > MAX_SECONDS) return null;

    const speed = new Array<number>(n).fill(0);
    const hr = new Array<number>(n).fill(0);
    const speedSet = new Array<boolean>(n).fill(false);
    const hrSet = new Array<boolean>(n).fill(false);
    let lastDist: number | undefined;
    let lastDistT = 0;
    for (const { t, rec } of samples) {
        if (t < 0 || t >= n) continue;
        let v = rec.speed;
        if (v === undefined && rec.distance !== undefined && lastDist !== undefined && t > lastDistT) {
            v = (rec.distance - lastDist) / (t - lastDistT);
        }
        if (rec.distance !== undefined) {
            lastDist = rec.distance;
            lastDistT = t;
        }
        if (v !== undefined && v >= 0 && v <= MAX_PLAUSIBLE_SPEED) {
            speed[t] = v;
            speedSet[t] = true;
        }
        if (rec.heartRate !== undefined && rec.heartRate > 0) {
            hr[t] = rec.heartRate;
            hrSet[t] = true;
        }
    }
    for (let i = 1; i < n; i++) {
        if (!speedSet[i]) speed[i] = speed[i - 1] ?? 0;
        if (!hrSet[i]) hr[i] = hr[i - 1] ?? 0;
    }
    const cum = new Array<number>(n + 1).fill(0);
    for (let i = 0; i < n; i++) cum[i + 1] = (cum[i] ?? 0) + (speed[i] ?? 0);
    return { speed, hr, cum, duration: n, totalMeters: cum[n] ?? 0 };
};

/** Meters covered after t elapsed seconds. */
export const distanceAt = (series: Series, t: number): number => {
    if (t <= 0) return 0;
    if (t >= series.duration) return series.totalMeters;
    const i = Math.floor(t);
    const a = series.cum[i] ?? 0;
    const b = series.cum[i + 1] ?? a;
    return a + (b - a) * (t - i);
};

/** Elapsed seconds at which d meters have been covered. */
export const timeAt = (series: Series, d: number): number => {
    if (d <= 0) return 0;
    if (d >= series.totalMeters) return series.duration;
    let lo = 0;
    let hi = series.cum.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((series.cum[mid] ?? 0) >= d) hi = mid;
        else lo = mid + 1;
    }
    // cum[lo - 1] < d <= cum[lo]
    const before = series.cum[lo - 1] ?? 0;
    const span = (series.cum[lo] ?? 0) - before;
    return span <= 0 ? lo : lo - 1 + (d - before) / span;
};

export type ResolvedInterval = WorkoutInterval &
    Required<Pick<WorkoutInterval, "startSeconds" | "endSeconds" | "durationSeconds" | "startMeters" | "endMeters" | "distanceMeters" | "avgPaceSecondsPerKm" | "avgHeartRate" | "maxHeartRate">>;

const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Derives the time range, distance, average pace and heart rate of an interval
 * from the profile. Runs past the end are clamped; an interval that starts
 * after the end resolves to zero duration.
 */
export const resolveInterval = (series: Series | null, iv: WorkoutInterval): ResolvedInterval => {
    let s = iv.start;
    let e = iv.start + iv.length;
    if (series !== null) {
        if (iv.basis === "distance") {
            s = timeAt(series, iv.start);
            e = timeAt(series, iv.start + iv.length);
            if (iv.start >= series.totalMeters) e = s;
        } else {
            e = Math.min(e, series.duration);
            if (s >= series.duration) e = s;
        }
    } else if (iv.basis === "distance") {
        s = 0;
        e = 0;
    }

    let startMeters = 0;
    let endMeters = 0;
    let avgHeartRate = 0;
    let maxHeartRate = 0;
    if (series !== null && e > s) {
        startMeters = distanceAt(series, s);
        endMeters = distanceAt(series, e);
        let sum = 0;
        let count = 0;
        for (let t = Math.floor(s); t < Math.ceil(e) && t < series.hr.length; t++) {
            const h = series.hr[t] ?? 0;
            if (h > 0) {
                sum += h;
                count++;
                maxHeartRate = Math.max(maxHeartRate, h);
            }
        }
        if (count > 0) avgHeartRate = sum / count;
    }
    const distanceMeters = endMeters - startMeters;
    const durationSeconds = e - s;
    return {
        ...iv,
        startSeconds: round1(s),
        endSeconds: round1(e),
        durationSeconds: round1(durationSeconds),
        startMeters: round1(startMeters),
        endMeters: round1(endMeters),
        distanceMeters: round1(distanceMeters),
        avgPaceSecondsPerKm: distanceMeters > 0 ? round1((durationSeconds / distanceMeters) * 1000) : 0,
        avgHeartRate: round1(avgHeartRate),
        maxHeartRate,
    };
};

/** The user-input fields only, which is what gets saved and compared for unsaved changes. */
export const toInput = (iv: WorkoutInterval): WorkoutInterval => ({
    kind: iv.kind,
    ...(iv.label ? { label: iv.label } : {}),
    basis: iv.basis,
    start: iv.start,
    length: iv.length,
});

/** Indexes of intervals that overlap another one, or that fall outside the activity. */
export const findProblems = (resolved: ResolvedInterval[]): { overlapping: Set<number>; outOfRange: Set<number> } => {
    const overlapping = new Set<number>();
    const outOfRange = new Set<number>();
    resolved.forEach((iv, i) => {
        if (iv.durationSeconds <= 0) outOfRange.add(i);
    });
    const order = resolved.map((_, i) => i).filter((i) => !outOfRange.has(i));
    order.sort((a, b) => (resolved[a]?.startSeconds ?? 0) - (resolved[b]?.startSeconds ?? 0));
    for (let k = 1; k < order.length; k++) {
        const prev = order[k - 1];
        const cur = order[k];
        if (prev === undefined || cur === undefined) continue;
        if ((resolved[cur]?.startSeconds ?? 0) < (resolved[prev]?.endSeconds ?? 0) - 1e-6) {
            overlapping.add(prev);
            overlapping.add(cur);
        }
    }
    return { overlapping, outOfRange };
};

export const formatClock = (seconds: number): string => {
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
};

/** Parses "90", "1:30" or "1:02:03" into seconds; returns null when it is not a time. */
export const parseClock = (text: string): number | null => {
    const parts = text.trim().split(":");
    if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
};

export const formatIntervalPace = (secondsPerKm: number): string => {
    if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "—";
    return `${formatClock(secondsPerKm)} /km`;
};

export const formatMeters = (meters: number): string => (meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`);

/** One-line recap of the work reps, e.g. "5 × work · avg 2:00 · 3:41 /km · HR 181". */
export const summarizeWork = (resolved: ResolvedInterval[]): string => {
    const work = resolved.filter((iv) => iv.kind === "work" && iv.durationSeconds > 0);
    if (work.length === 0) return "";
    const duration = work.reduce((a, iv) => a + iv.durationSeconds, 0);
    const distance = work.reduce((a, iv) => a + iv.distanceMeters, 0);
    const hrReps = work.filter((iv) => iv.avgHeartRate > 0);
    const parts = [`${work.length} × work`, `avg ${formatClock(duration / work.length)}`];
    if (distance > 0) parts.push(formatIntervalPace((duration / distance) * 1000));
    if (hrReps.length > 0) parts.push(`HR ${Math.round(hrReps.reduce((a, iv) => a + iv.avgHeartRate, 0) / hrReps.length)}`);
    return parts.join(" · ");
};

/** A point of the smoothed pace profile; v is null (breaking the line) while standing still. */
export interface PaceSample {
    t: number;
    v: number | null; // seconds per km
}

const PACE_WINDOW = 15; // seconds of smoothing for the pace profile
const PACE_STEP = 2;
export const MIN_PACE_SPEED = 0.8; // m/s; slower counts as standing still

export const paceProfile = (series: Series): PaceSample[] => {
    const points: PaceSample[] = [];
    for (let t = 0; t < series.duration; t += PACE_STEP) {
        const lo = Math.max(0, t - PACE_WINDOW / 2);
        const hi = Math.min(series.duration, t + PACE_WINDOW / 2);
        const dist = distanceAt(series, hi) - distanceAt(series, lo);
        const speed = hi > lo ? dist / (hi - lo) : 0;
        points.push({ t, v: speed >= MIN_PACE_SPEED ? 1000 / speed : null });
    }
    return points;
};


/** Intervals ordered by where they start in the activity (stable, so equal starts keep their order). */
export const sortByStart = (series: Series | null, intervals: WorkoutInterval[]): WorkoutInterval[] =>
    intervals
        .map((iv) => ({ iv, start: resolveInterval(series, iv).startSeconds }))
        .sort((a, b) => a.start - b.start)
        .map((x) => x.iv);

/**
 * Moves the interval at `from` to position `to` in the sequence and lays the
 * sequence out again: it starts where the first interval started, every
 * interval keeps its own length, and the gaps between positions stay as they
 * were. `resolved` must be in start order.
 */
export const reorderIntervals = (series: Series | null, resolved: ResolvedInterval[], from: number, to: number): WorkoutInterval[] => {
    const inRange = (i: number): boolean => i >= 0 && i < resolved.length;
    if (from === to || !inRange(from) || !inRange(to)) return resolved.map(toInput);

    const order = resolved.map((_, i) => i);
    order.splice(to, 0, ...order.splice(from, 1));

    let cursor = resolved[0]?.startSeconds ?? 0;
    return order.map((source, position) => {
        const iv = resolved[source];
        if (iv === undefined) throw new Error("interval index out of range");
        let start = cursor;
        let end = cursor + iv.length;
        if (iv.basis === "distance" && series !== null) {
            start = distanceAt(series, cursor);
            end = timeAt(series, start + iv.length);
        }
        const gap = Math.max(0, (resolved[position + 1]?.startSeconds ?? 0) - (resolved[position]?.endSeconds ?? 0));
        cursor = end + (position < resolved.length - 1 ? gap : 0);
        return { ...toInput(iv), start: iv.basis === "distance" ? Math.round(start) : round1(start) };
    });
};
