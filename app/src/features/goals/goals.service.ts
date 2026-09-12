import { apiRequest } from "../../shared/api/client";
import type { GoalWithProgress } from "../activity/activity.service";

export type { GoalWithProgress } from "../activity/activity.service";

export type GoalType = "weekly_distance" | "monthly_distance";

export const fetchGoals = async (): Promise<{ goals: GoalWithProgress[] }> => {
    return apiRequest({ method: "GET", path: "/api/goals" });
};

export const createGoal = async (input: { type: GoalType; targetMeters: number }): Promise<GoalWithProgress> => {
    return apiRequest({
        method: "POST",
        path: "/api/goals",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
    });
};

export const updateGoal = async (
    id: string,
    input: { targetMeters: number; active: boolean },
): Promise<GoalWithProgress> => {
    return apiRequest({
        method: "PUT",
        path: `/api/goals/${encodeURIComponent(id)}`,
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
    });
};

export const deleteGoal = async (id: string): Promise<{ status: string }> => {
    return apiRequest({ method: "DELETE", path: `/api/goals/${encodeURIComponent(id)}` });
};
