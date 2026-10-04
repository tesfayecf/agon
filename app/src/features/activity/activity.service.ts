import { apiRequest } from "../../shared/api/client";

export interface ActivityRecord {
    timestamp?: string;
    latitude?: number;
    longitude?: number;
    distance?: number;
    speed?: number;
    heartRate?: number;
    altitude?: number;
}

export type WorkoutType = "" | "easy" | "long" | "tempo" | "hills" | "intervals" | "race" | "other";
export type IntervalKind = "warmup" | "work" | "recovery" | "cooldown";
/** Unit of an interval's start and length: seconds ("time") or meters ("distance"). */
export type IntervalBasis = "time" | "distance";

/**
 * One segment of an interval training. kind/label/basis/start/length are the
 * user's input; every other field is derived from the pace and heart-rate
 * profile (by the server on save, and by `resolveInterval` for live previews).
 */
export interface WorkoutInterval {
    kind: IntervalKind;
    label?: string;
    basis: IntervalBasis;
    start: number;
    length: number;
    startSeconds?: number;
    endSeconds?: number;
    durationSeconds?: number;
    startMeters?: number;
    endMeters?: number;
    distanceMeters?: number;
    avgPaceSecondsPerKm?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
}

export interface ActivityFile {
    id: string;
    filename: string;
    fileType: string;
    activityDate?: string;
    durationSeconds?: number;
    distanceMeters?: number;
    recordCount: number;
    records?: ActivityRecord[];
    status: "success" | "error";
    error?: string;
    s3Key?: string;
    fileSize?: number;
    createdAt?: string;
    name?: string;
    description?: string;
    tags?: string;
    elevationGain?: number;
    avgHeartRate?: number;
    workoutType?: WorkoutType;
    intervals?: WorkoutInterval[];
}

export const updateActivityFileMetadata = async (
    id: string,
    metadata: { name: string; description: string; tags: string },
): Promise<ActivityFile> => {
    return apiRequest<ActivityFile>({
        method: "PUT",
        path: `/api/activities/${encodeURIComponent(id)}`,
        body: metadata,
    });
};

export const updateActivityWorkout = async (
    id: string,
    workout: { workoutType: WorkoutType; intervals: WorkoutInterval[] },
): Promise<ActivityFile> => {
    return apiRequest<ActivityFile>({
        method: "PUT",
        path: `/api/activities/${encodeURIComponent(id)}/workout`,
        body: workout,
    });
};

export const deleteActivityFile = async (id: string): Promise<void> => {
    await apiRequest<{ id: string; deleted: boolean }>({
        method: "DELETE",
        path: `/api/activities/${encodeURIComponent(id)}`,
    });
};

export interface WeeklyTrendPoint {
    weekStart: string;
    distanceMeters: number;
    sessionCount: number;
    isCurrent: boolean;
}

export interface MonthlyTrendPoint {
    month: string;
    distanceMeters: number;
    sessionCount: number;
    isCurrent: boolean;
}

export interface PaceTrendPoint {
    weekStart: string;
    avgPaceSecondsPerKm: number;
    distanceMeters: number;
    isCurrent: boolean;
}

export interface HeartRateTrendPoint {
    weekStart: string;
    avgHeartRate: number;
    distanceMeters: number;
    isCurrent: boolean;
}

export interface PersonalBest {
    label: string;
    distanceMeters: number;
    bestSeconds: number;
    date: string;
    activityId: string;
    activityName: string;
}

export interface PaceHeartRatePoint {
    date: string;
    paceSecondsPerKm: number;
    avgHeartRate: number;
    distanceMeters: number;
    activityId: string;
    activityName: string;
}

export interface GoalWithProgress {
    id: string;
    type: "weekly_distance" | "monthly_distance";
    targetMeters: number;
    active: boolean;
    createdAt: string;
    achievedMeters: number;
    remainingMeters: number;
    percentComplete: number;
    periodStart: string;
    periodEnd: string;
}

export type TrainingLoadStatus = "insufficient_data" | "low" | "optimal" | "caution" | "high";

export interface TrainingLoad {
    acuteDistanceMeters: number;
    chronicWeeklyAvgMeters: number;
    ratio: number;
    status: TrainingLoadStatus;
    hasEnoughHistory: boolean;
}

export interface DashboardStats {
    totalDistance: number;
    totalElevation: number;
    totalDuration: number;
    trainingCount: number;
    avgHeartRate: number;
    currentWeekDistance: number;
    currentWeekSessions: number;
    currentMonthDistance: number;
    currentMonthSessions: number;
    weeklyTrend: WeeklyTrendPoint[];
    monthlyTrend: MonthlyTrendPoint[];
    paceTrend: PaceTrendPoint[];
    heartRateTrend: HeartRateTrendPoint[];
    paceHeartRatePoints: PaceHeartRatePoint[];
    personalBests: PersonalBest[];
    trainingLoad: TrainingLoad;
    goals: GoalWithProgress[];
    endurance: EnduranceAnalytics;
    intervals: IntervalAnalytics;
    racePredictor: RacePredictor;
}

export interface RunSummary {
    activityId: string;
    activityName: string;
    date: string;
    distanceMeters: number;
    durationSeconds: number;
    avgHeartRate: number;
}

export interface EnduranceWeekPoint {
    weekStart: string;
    distanceMeters: number;
    longestMeters: number;
    runCount: number;
    isCurrent: boolean;
}

export interface DistanceBand {
    label: string;
    minMeters: number;
    /** 0 for the open-ended last band. */
    maxMeters: number;
    count: number;
}

/** Every completed run that is not an interval session. Totals cover the last `windowWeeks` weeks. */
export interface EnduranceAnalytics {
    windowWeeks: number;
    runCount: number;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    elevationGainMeters: number;
    avgDistanceMeters: number;
    avgPaceSecondsPerKm: number;
    avgHeartRate: number;
    longestRun: RunSummary | null;
    weekly: EnduranceWeekPoint[];
    efficiencyPoints: PaceHeartRatePoint[];
    distanceBands: DistanceBand[];
}

export interface IntervalRep {
    label?: string;
    basis: IntervalBasis;
    durationSeconds: number;
    distanceMeters: number;
    avgPaceSecondsPerKm: number;
    avgHeartRate: number;
    maxHeartRate: number;
    /** False when the pace looks like a GPS glitch; such reps are left out of pace figures. */
    plausible: boolean;
}

export interface SessionSegment {
    kind: IntervalKind;
    startSeconds: number;
    durationSeconds: number;
    avgPaceSecondsPerKm: number;
    avgHeartRate: number;
}

export interface IntervalSession {
    activityId: string;
    activityName: string;
    date: string;
    durationSeconds: number;
    structure: string;
    repCount: number;
    workSeconds: number;
    workMeters: number;
    recoverySeconds: number;
    avgWorkPaceSecondsPerKm: number;
    avgWorkHeartRate: number;
    workMetersPerBeat: number;
    /** Last vs. first rep of the session's most common length, in %; positive = slower. */
    fadePercent: number | null;
    reps: IntervalRep[];
    segments: SessionSegment[];
}

export interface RepPacePoint {
    date: string;
    activityId: string;
    activityName: string;
    avgPaceSecondsPerKm: number;
    avgHeartRate: number;
    reps: number;
}

export interface RepDurationSeries {
    durationSeconds: number;
    label: string;
    sessionCount: number;
    points: RepPacePoint[];
}

export interface QualityWeekPoint {
    weekStart: string;
    workSeconds: number;
    workMeters: number;
    totalSeconds: number;
    intervalSessionCount: number;
    isCurrent: boolean;
}

/** Labelled interval sessions. Counters cover the last `windowWeeks` weeks; sessions are chronological. */
export interface IntervalAnalytics {
    windowWeeks: number;
    sessionCount: number;
    repCount: number;
    workSeconds: number;
    workMeters: number;
    workShare: number;
    avgWorkRestRatio: number;
    unlabelledCount: number;
    sessions: IntervalSession[];
    repProgression: RepDurationSeries[];
    weeklyQuality: QualityWeekPoint[];
}

export type PredictionMethod = "none" | "best_effort" | "heart_rate";

export interface RacePrediction {
    label: string;
    distanceMeters: number;
    predictedSeconds: number;
    paceSecondsPerKm: number;
    /** 0 when no personal best exists for this distance. */
    personalBestSeconds: number;
    /** The race is far longer than any recent run, so endurance is unproven. */
    isExtrapolated: boolean;
}

export interface PredictionBasis {
    activityId: string;
    activityName: string;
    date: string;
    distanceMeters: number;
    durationSeconds: number;
    vdot: number;
}

export interface VDOTTrendPoint {
    weekStart: string;
    vdot: number;
    runCount: number;
    isCurrent: boolean;
}

/** VDOT-based race predictions from the last `windowWeeks` weeks of non-interval runs. */
export interface RacePredictor {
    method: PredictionMethod;
    vdot: number;
    windowWeeks: number;
    sampleCount: number;
    hasHeartRateProfile: boolean;
    longestRunMeters: number;
    basis: PredictionBasis | null;
    predictions: RacePrediction[];
    trend: VDOTTrendPoint[];
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    return apiRequest({
        method: "GET",
        path: "/api/dashboard",
    });
};

export interface ActivityListPayload {
    files: ActivityFile[];
    count?: number;
}

export interface ActivityUploadPayload {
    files: ActivityFile[];
}

export interface ActivityFilterParams {
    q?: string;
    tag?: string;
    dateFrom?: string;
    dateTo?: string;
    minDistance?: number;
    maxDistance?: number;
}

export const fetchActivityFiles = async (filters?: ActivityFilterParams): Promise<ActivityListPayload> => {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.tag) params.set("tag", filters.tag);
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    if (filters?.minDistance !== undefined) params.set("minDistance", String(filters.minDistance));
    if (filters?.maxDistance !== undefined) params.set("maxDistance", String(filters.maxDistance));
    const query = params.toString();
    return apiRequest<ActivityListPayload>({
        method: "GET",
        path: query ? `/api/activities?${query}` : "/api/activities",
    });
};

export const fetchActivityFileById = async (id: string): Promise<ActivityFile> => {
    return apiRequest<ActivityFile>({
        method: "GET",
        path: `/api/activities/${encodeURIComponent(id)}`,
    });
};

export const uploadActivityFiles = async (
    files: FileList | File[],
): Promise<ActivityUploadPayload> => {
    const formData = new FormData();
    const items = Array.from(files);

    for (const file of items) {
        formData.append("files", file, file.name);
    }

    return apiRequest<ActivityUploadPayload>({
        method: "POST",
        path: "/api/activities/upload",
        body: formData as unknown as BodyInit,
        headers: {
            Accept: "application/json",
        },
    });
};

