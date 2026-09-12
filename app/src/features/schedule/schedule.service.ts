import { apiRequest } from "../../shared/api/client";
import type { ActivityFile } from "../activity/activity.service";

export interface ScheduleSlot {
    dayOfWeek: number; // 0 = Monday .. 6 = Sunday
    trainingType?: string;
    title?: string;
    targetDistanceMeters?: number;
    targetDurationSeconds?: number;
    targetPaceSecondsPerKm?: number;
    notes?: string;
}

export interface PlannedSession {
    id: string;
    date: string; // YYYY-MM-DD
    trainingType?: string;
    title?: string;
    targetDistanceMeters?: number;
    targetDurationSeconds?: number;
    targetPaceSecondsPerKm?: number;
    notes?: string;
    createdAt?: string;
}

export interface CalendarPlannedEntry {
    id?: string;
    trainingType?: string;
    title?: string;
    targetDistanceMeters?: number;
    targetDurationSeconds?: number;
    targetPaceSecondsPerKm?: number;
    notes?: string;
    isTemplateDefault: boolean;
    isCompleted: boolean;
}

export interface CalendarDayView {
    date: string;
    isToday: boolean;
    completed: ActivityFile[];
    planned: CalendarPlannedEntry[];
}

export interface CalendarWeekPayload {
    weekStart: string;
    weekEnd: string;
    days: CalendarDayView[];
}

export const fetchTemplate = async (): Promise<{ days: ScheduleSlot[] }> => {
    return apiRequest({ method: "GET", path: "/api/schedule/template" });
};

export const saveTemplate = async (days: ScheduleSlot[]): Promise<{ days: ScheduleSlot[] }> => {
    return apiRequest({
        method: "PUT",
        path: "/api/schedule/template",
        body: { days },
    });
};

export const fetchCalendarWeek = async (date: string): Promise<CalendarWeekPayload> => {
    return apiRequest({ method: "GET", path: `/api/calendar/week?date=${encodeURIComponent(date)}` });
};

export const createPlannedSession = async (
    input: Omit<PlannedSession, "id" | "createdAt">,
): Promise<PlannedSession> => {
    return apiRequest({
        method: "POST",
        path: "/api/schedule/planned",
        body: input,
    });
};

export const deletePlannedSession = async (id: string): Promise<{ status: string }> => {
    return apiRequest({ method: "DELETE", path: `/api/schedule/planned/${encodeURIComponent(id)}` });
};
