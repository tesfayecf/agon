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
}

// ... existing code ...

export const updateActivityFileMetadata = async (
    id: string,
    metadata: { name: string; description: string; tags: string },
): Promise<ActivityFile> => {
    return apiRequest<ActivityFile>({
        method: "PUT",
        path: `/api/activities/${encodeURIComponent(id)}`,
        body: JSON.stringify(metadata),
        headers: {
            "Content-Type": "application/json",
        },
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

export interface DashboardStats {
    totalDistance: number;
    totalElevation: number;
    totalDuration: number;
    trainingCount: number;
    avgHeartRate: number;
    recentActivities: ActivityFile[];
    currentWeekDistance: number;
    currentWeekSessions: number;
    currentMonthDistance: number;
    currentMonthSessions: number;
    weeklyTrend: WeeklyTrendPoint[];
    monthlyTrend: MonthlyTrendPoint[];
    paceTrend: PaceTrendPoint[];
    heartRateTrend: HeartRateTrendPoint[];
    personalBests: PersonalBest[];
    goals: GoalWithProgress[];
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

