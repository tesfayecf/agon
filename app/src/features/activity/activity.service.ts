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

export const fetchDashboardStats = async (): Promise<{
    totalDistance: number;
    totalElevation: number;
    totalDuration: number;
    trainingCount: number;
    avgHeartRate: number;
    recentActivities: ActivityFile[];
}> => {
    return apiRequest({
        method: "GET",
        path: "/api/dashboard",
    });
};

export interface ActivityListPayload {
    files: ActivityFile[];
}

export interface ActivityUploadPayload {
    files: ActivityFile[];
}

export const fetchActivityFiles = async (): Promise<ActivityListPayload> => {
    return apiRequest<ActivityListPayload>({
        method: "GET",
        path: "/api/activities",
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

