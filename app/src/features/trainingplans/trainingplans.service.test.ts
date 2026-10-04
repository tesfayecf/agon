import { describe, expect, it } from "vitest";
import { sortPlans, type TrainingPlan } from "./trainingplans.service";

const plan = (id: string, status: TrainingPlan["status"], createdAt: string): TrainingPlan => ({
    id,
    title: `Plan ${id}`,
    status,
    weekCount: 4,
    sessionCount: 1,
    generationParams: {},
    createdAt,
});

describe("sortPlans", () => {
    it("orders active before draft before archived", () => {
        const plans = sortPlans([
            plan("archived-1", "archived", "2026-01-01T00:00:00Z"),
            plan("draft-1", "draft", "2026-01-01T00:00:00Z"),
            plan("active-1", "active", "2026-01-01T00:00:00Z"),
        ]);
        expect(plans.map((p) => p.status)).toEqual(["active", "draft", "archived"]);
    });

    it("sorts newest first within the same status", () => {
        const plans = sortPlans([
            plan("old", "draft", "2026-01-01T00:00:00Z"),
            plan("new", "draft", "2026-06-01T00:00:00Z"),
        ]);
        expect(plans.map((p) => p.id)).toEqual(["new", "old"]);
    });

    it("does not mutate the input array", () => {
        const input = [plan("a", "archived", "2026-01-01T00:00:00Z")];
        const copy = [...input];
        sortPlans(input);
        expect(input).toEqual(copy);
    });
});