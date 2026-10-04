import type { ReactElement } from "react";
import { Badge } from "../../shared/components/Badge";
import { PLAN_STATUS_LABELS, type PlanStatus } from "./trainingplans.service";

const STATUS_TONES: Record<PlanStatus, "success" | "warning" | "neutral"> = {
    active: "success",
    archived: "warning",
    draft: "neutral",
};

export const PlanStatusBadge = ({ status }: { status: PlanStatus }): ReactElement => (
    <Badge tone={STATUS_TONES[status]}>{PLAN_STATUS_LABELS[status]}</Badge>
);