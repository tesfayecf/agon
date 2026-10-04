import { apiRequest } from "../../shared/api/client";

export type PlanStatus = "draft" | "active" | "archived";

export interface GenerationParams {
    prompt?: string;
    system?: string;
    model?: string;
    provider?: string;
}

export interface TrainingPlan {
    id: string;
    title: string;
    description?: string;
    reasoning?: string;
    generationParams: GenerationParams;
    weekCount: number;
    startDate?: string;
    endDate?: string;
    status: PlanStatus;
    sessionCount: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface TrainingPlanSession {
    id?: string;
    planId?: string;
    weekNumber: number; // 1-based
    dayOfWeek: number; // 0 = Monday .. 6 = Sunday
    date?: string; // YYYY-MM-DD
    trainingType?: string;
    title?: string;
    description?: string;
    targetDistanceMeters?: number;
    targetDurationSeconds?: number;
    targetPaceSecondsPerKm?: number;
    targetHeartRateMin?: number;
    targetHeartRateMax?: number;
    intensity?: string; // easy | moderate | hard | recovery
    sortOrder?: number;
    notes?: string;
}

export interface PlanDetailPayload {
    plan: TrainingPlan;
    sessions: TrainingPlanSession[];
}

export type PlanStatusFilter = PlanStatus | "all";

const statusCode = (status: PlanStatus): number => {
    switch (status) {
        case "active":
            return 0;
        case "draft":
            return 1;
        default:
            return 2; // archived
    }
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
    draft: "Draft",
    active: "Active",
    archived: "Archived",
};

export const SORTED_PLAN_STATUSES: PlanStatus[] = ["active", "draft", "archived"];

export const sortPlans = (plans: TrainingPlan[]): TrainingPlan[] =>
    [...plans].sort(
        (a, b) =>
            statusCode(a.status) - statusCode(b.status) ||
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );

export const fetchTrainingPlans = async (status?: PlanStatusFilter): Promise<{ plans: TrainingPlan[] }> => {
    const query = status !== undefined && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest({ method: "GET", path: `/api/training-plans${query}` });
};

export const fetchTrainingPlan = async (id: string): Promise<PlanDetailPayload> => {
    return apiRequest({ method: "GET", path: `/api/training-plans/${encodeURIComponent(id)}` });
};

export const createTrainingPlan = async (input: {
    plan: Partial<TrainingPlan> & Pick<TrainingPlan, "title" | "weekCount">;
    sessions: TrainingPlanSession[];
}): Promise<PlanDetailPayload> => {
    return apiRequest({
        method: "POST",
        path: "/api/training-plans",
        body: { plan: input.plan, sessions: input.sessions },
    });
};

export const updateTrainingPlanStatus = async (id: string, status: PlanStatus): Promise<{ status: string }> => {
    return apiRequest({
        method: "PUT",
        path: `/api/training-plans/${encodeURIComponent(id)}/status`,
        body: { status },
    });
};

export const deleteTrainingPlan = async (id: string): Promise<{ deleted: boolean; id: string }> => {
    return apiRequest({ method: "DELETE", path: `/api/training-plans/${encodeURIComponent(id)}` });
};