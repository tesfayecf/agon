import { useEffect, useState, type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    deleteTrainingPlan,
    fetchTrainingPlans,
    PLAN_STATUS_LABELS,
    sortPlans,
    updateTrainingPlanStatus,
    type PlanStatus,
    type PlanStatusFilter,
    type TrainingPlan,
} from "./trainingplans.service";
import { PlanComposer } from "./PlanComposer";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDate } from "../../shared/utils/format";

const FILTERS: PlanStatusFilter[] = ["all", "active", "draft", "archived"];

export const TrainingPlansPage = (): ReactElement => {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<TrainingPlan[]>([]);
    const [filter, setFilter] = useState<PlanStatusFilter>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isComposing, setIsComposing] = useState(false);
    const [busyIds, setBusyIds] = useState<string[]>([]);

    const load = () => {
        setIsLoading(true);
        setError(null);
        fetchTrainingPlans(filter)
            .then((res) => setPlans(sortPlans(res.plans)))
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load training plans."))
            .finally(() => setIsLoading(false));
    };

    useEffect(load, [filter]);

    const transition = async (plan: TrainingPlan, status: PlanStatus) => {
        setBusyIds((prev) => [...prev, plan.id]);
        setError(null);
        try {
            await updateTrainingPlanStatus(plan.id, status);
            setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, status } : p)));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update the plan status.");
        } finally {
            setBusyIds((prev) => prev.filter((id) => id !== plan.id));
        }
    };

    const remove = async (plan: TrainingPlan) => {
        if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
        setBusyIds((prev) => [...prev, plan.id]);
        setError(null);
        try {
            await deleteTrainingPlan(plan.id);
            setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete the training plan.");
        } finally {
            setBusyIds((prev) => prev.filter((id) => id !== plan.id));
        }
    };

    const filtered = filter === "all" ? plans : plans.filter((p) => p.status === filter);

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Coaching"
                title="Training Plans"
                subtitle="AI-generated multi-week training plans. Create them from an AI assistant via MCP, or compose one here."
                actions={
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setIsComposing((v) => !v)}
                        aria-expanded={isComposing}
                    >
                        {isComposing ? "Close composer" : "+ New plan"}
                    </button>
                }
            />

            {isComposing && (
                <PlanComposer onCreated={(id) => navigate(`/plans/${id}`)} onCancel={() => setIsComposing(false)} />
            )}

            <div className="plan-toolbar" role="tablist" aria-label="Filter plans by status">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        role="tab"
                        aria-selected={filter === f}
                        className={`chip${filter === f ? " chip--active" : ""}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === "all" ? "All" : PLAN_STATUS_LABELS[f]}
                        <span className="chip__count">
                            {f === "all" ? plans.length : plans.filter((p) => p.status === f).length}
                        </span>
                    </button>
                ))}
            </div>

            {error !== null && <ErrorState message={error} />}
            {isLoading ? (
                <Card>
                    <LoadingState label="Loading training plans…" />
                </Card>
            ) : filtered.length === 0 ? (
                <Card>
                    <EmptyState
                        title={filter === "all" ? "No training plans yet" : `No ${PLAN_STATUS_LABELS[filter as PlanStatus]} plans`}
                        message={
                            filter === "all"
                                ? 'Ask an AI assistant to generate one via the MCP, or press "+ New plan" to compose it here.'
                                : "Plans in this state will appear here."
                        }
                        action={
                            !isComposing ? (
                                <button type="button" className="btn btn-ghost" onClick={() => setIsComposing(true)}>
                                    + New plan
                                </button>
                            ) : undefined
                        }
                    />
                </Card>
            ) : (
                <div className="plan-list">
                    {filtered.map((plan) => {
                        const busy = busyIds.includes(plan.id);
                        return (
                            <Card key={plan.id} className="plan-card">
                                <div className="plan-card__main">
                                    <div className="plan-card__heading">
                                        <Link to={`/plans/${plan.id}`} className="plan-card__title">
                                            {plan.title}
                                        </Link>
                                        <PlanStatusBadge status={plan.status} />
                                    </div>
                                    {plan.description !== "" && plan.description !== undefined ? (
                                        <p className="plan-card__description">{plan.description}</p>
                                    ) : null}
                                    {plan.reasoning !== "" && plan.reasoning !== undefined ? (
                                        <p className="plan-card__reasoning">{plan.reasoning}</p>
                                    ) : null}
                                    <ul className="plan-card__meta">
                                        <li>
                                            <strong>{plan.weekCount}</strong> {plan.weekCount === 1 ? "week" : "weeks"}
                                        </li>
                                        <li>
                                            <strong>{plan.sessionCount}</strong> sessions
                                        </li>
                                        {plan.startDate !== "" && plan.startDate !== undefined && (
                                            <li>
                                                {formatDate(plan.startDate)}
                                                {plan.endDate ? ` → ${formatDate(plan.endDate)}` : ""}
                                            </li>
                                        )}
                                        {plan.createdAt !== undefined && <li>Created {formatDate(plan.createdAt)}</li>}
                                        {plan.generationParams.model !== "" &&
                                            plan.generationParams.model !== undefined &&
                                            plan.generationParams.model !== "mcp-ai-model" && (
                                                <li>Generated by {plan.generationParams.model}</li>
                                            )}
                                    </ul>
                                </div>
                                <div className="plan-card__actions">
                                    <Link className="btn btn-ghost btn-sm" to={`/plans/${plan.id}`}>
                                        Open
                                    </Link>
                                    {plan.status !== "active" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            disabled={busy}
                                            onClick={() => transition(plan, "active")}
                                        >
                                            Activate
                                        </button>
                                    )}
                                    {plan.status === "active" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-ghost"
                                            disabled={busy}
                                            onClick={() => transition(plan, "archived")}
                                        >
                                            Archive
                                        </button>
                                    )}
                                    {plan.status !== "draft" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-ghost"
                                            disabled={busy}
                                            onClick={() => transition(plan, "draft")}
                                        >
                                            Reopen
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        disabled={busy}
                                        onClick={() => remove(plan)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Card className="plan-note-card">
                <p className="card__note">
                    <strong>Tip:</strong> AI-generated plans (from Claude, Copilot, or any MCP client) land here automatically and
                    stay in <em>draft</em> until you activate them. Total load and progress against these plans will be
                    compared with your completed trainings on the calendar.
                </p>
            </Card>
        </section>
    );
};