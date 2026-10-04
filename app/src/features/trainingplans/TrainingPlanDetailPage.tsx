import { Fragment, useEffect, useState, type ReactElement } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
    deleteTrainingPlan,
    fetchTrainingPlan,
    updateTrainingPlanStatus,
    type PlanStatus,
    type TrainingPlan,
    type TrainingPlanSession,
} from "./trainingplans.service";
import { PlanStatusBadge } from "./PlanStatusBadge";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { Badge } from "../../shared/components/Badge";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDate, formatDistance, formatDuration, formatPace } from "../../shared/utils/format";

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const INTENSITY_LABELS: Record<string, string> = {
    easy: "Easy",
    moderate: "Moderate",
    hard: "Hard",
    recovery: "Recovery",
};

export const TrainingPlanDetailPage = (): ReactElement => {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const [plan, setPlan] = useState<TrainingPlan | null>(null);
    const [sessions, setSessions] = useState<TrainingPlanSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    const load = () => {
        setIsLoading(true);
        setError(null);
        fetchTrainingPlan(id)
            .then((res) => {
                setPlan(res.plan);
                setSessions(res.sessions);
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load the training plan."))
            .finally(() => setIsLoading(false));
    };

    useEffect(load, [id]);

    const transition = async (status: PlanStatus) => {
        if (plan === null) return;
        setIsBusy(true);
        setError(null);
        try {
            await updateTrainingPlanStatus(plan.id, status);
            setPlan((p) => (p === null ? p : { ...p, status }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update the plan status.");
        } finally {
            setIsBusy(false);
        }
    };

    const remove = async () => {
        if (plan === null) return;
        if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
        setIsBusy(true);
        try {
            await deleteTrainingPlan(plan.id);
            navigate("/plans");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete the training plan.");
            setIsBusy(false);
        }
    };

    // Group sessions by week, preserving order from the API.
    const weeks = new Map<number, TrainingPlanSession[]>();
    for (const s of sessions) {
        const current = weeks.get(s.weekNumber) ?? [];
        current.push(s);
        weeks.set(s.weekNumber, current);
    }
    const weekNumbers = [...weeks.keys()].sort((a, b) => a - b);

    return (
        <section aria-live="polite">
            {isLoading ? (
                <Card>
                    <LoadingState label="Loading training plan…" />
                </Card>
            ) : plan === null ? (
                <Card>
                    {error !== null ? (
                        <ErrorState message={error} />
                    ) : (
                        <EmptyState title="Training plan not found" message="It may have been deleted." action={<Link to="/plans" className="btn btn-ghost">Back to plans</Link>} />
                    )}
                </Card>
            ) : (
                <>
                    <PageHeader
                        eyebrow="Coaching"
                        title={plan.title}
                        subtitle={plan.description !== "" ? plan.description : undefined}
                        actions={
                            <div className="page-header__actions-inline">
                                <Link className="btn btn-ghost btn-sm" to="/plans">
                                    ← All plans
                                </Link>
                                {plan.status !== "active" && (
                                    <button type="button" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => transition("active")}>
                                        Activate
                                    </button>
                                )}
                                {plan.status === "active" && (
                                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy} onClick={() => transition("archived")}>
                                        Archive
                                    </button>
                                )}
                                {plan.status !== "draft" && (
                                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy} onClick={() => transition("draft")}>
                                        Reopen draft
                                    </button>
                                )}
                                <button type="button" className="btn btn-danger btn-sm" disabled={isBusy} onClick={remove}>
                                    Delete
                                </button>
                            </div>
                        }
                    />

                    {error !== null && <ErrorState message={error} />}

                    <div className="kpi-grid">
                        <div className="metric-card">
                            <span className="metric-card__label">Status</span>
                            <PlanStatusBadge status={plan.status} />
                        </div>
                        <div className="metric-card">
                            <span className="metric-card__label">Weeks</span>
                            <strong className="metric-card__value">{plan.weekCount}</strong>
                        </div>
                        <div className="metric-card">
                            <span className="metric-card__label">Sessions</span>
                            <strong className="metric-card__value">{plan.sessionCount}</strong>
                        </div>
                        <div className="metric-card">
                            <span className="metric-card__label">Period</span>
                            <span className="metric-card__value metric-card__value--muted">
                                {plan.startDate !== "" && plan.startDate !== undefined
                                    ? `${formatDate(plan.startDate)}${plan.endDate ? ` — ${formatDate(plan.endDate)}` : ""}`
                                    : "Flexible dates"}
                            </span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-card__label">Created</span>
                            <span className="metric-card__value metric-card__value--muted">{formatDate(plan.createdAt)}</span>
                        </div>
                    </div>

                    {plan.reasoning !== "" && plan.reasoning !== undefined && (
                        <Card title="AI reasoning" eyebrow="Why this plan">
                            <p className="plan-reasoning">{plan.reasoning}</p>
                            {(plan.generationParams.prompt !== "" && plan.generationParams.prompt !== undefined) ||
                            (plan.generationParams.model !== "" && plan.generationParams.model !== undefined) ? (
                                <p className="plan-reasoning__meta">
                                    {plan.generationParams.provider !== "" &&
                                        plan.generationParams.provider !== undefined &&
                                        `Provider: ${plan.generationParams.provider} · `}
                                    {plan.generationParams.model !== "" && plan.generationParams.model !== undefined && plan.generationParams.model !== "mcp-ai-model" && `Model: ${plan.generationParams.model}`}
                                </p>
                            ) : null}
                        </Card>
                    )}

                    <Card
                        title="Sessions"
                        eyebrow={`${sessions.length} planned sessions`}
                        actions={<span className="badge badge--neutral">{weekNumbers.length} week{weekNumbers.length === 1 ? "" : "s"}</span>}
                    >
                        {sessions.length === 0 ? (
                            <EmptyState title="No sessions yet" message="This plan has no concrete sessions." />
                        ) : (
                            <table className="record-table plan-sessions">
                                <thead>
                                    <tr>
                                        <th>Day</th>
                                        <th>Type</th>
                                        <th>Session</th>
                                        <th>Intensity</th>
                                        <th>Distance</th>
                                        <th>Duration</th>
                                        <th>Pace</th>
                                        <th>HR zone</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weekNumbers.map((weekNumber) => {
                                        const weekSessions = weeks.get(weekNumber) ?? [];
                                        return (
                                            <Fragment key={weekNumber}>
                                                <tr className="plan-sessions__week">
                                                    <td colSpan={9}>Week {weekNumber}</td>
                                                </tr>
                                                {weekSessions.map((s) => (
                                                    <tr key={s.id ?? `${weekNumber}-${s.dayOfWeek}-${s.sortOrder}`}>
                                                        <td>{WEEKDAY_LABELS[s.dayOfWeek] ?? s.dayOfWeek}</td>
                                                        <td>{s.trainingType !== "" ? s.trainingType : "—"}</td>
                                                        <td>
                                                            <strong>{s.title !== "" ? s.title : "Untitled session"}</strong>
                                                            {s.description !== "" && s.description !== undefined && (
                                                                <span className="plan-sessions__desc"> · {s.description}</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {s.intensity !== undefined && s.intensity !== "" ? (
                                                                <Badge tone={intensityTone(s.intensity)}>{INTENSITY_LABELS[s.intensity] ?? s.intensity}</Badge>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </td>
                                                        <td>{formatDistance(s.targetDistanceMeters)}</td>
                                                        <td>{formatDuration(s.targetDurationSeconds)}</td>
                                                        <td>{formatPace(s.targetPaceSecondsPerKm)}</td>
                                                        <td>
                                                            {s.targetHeartRateMin != null && s.targetHeartRateMin > 0
                                                                ? `${s.targetHeartRateMin}–${s.targetHeartRateMax ?? "?"} bpm`
                                                                : "—"}
                                                        </td>
                                                        <td className="plan-sessions__notes">{s.notes ?? ""}</td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </Card>
                </>
            )}
        </section>
    );
};

const intensityTone = (intensity: string): "success" | "warning" | "danger" | "neutral" => {
    switch (intensity) {
        case "hard":
            return "danger";
        case "moderate":
            return "warning";
        case "easy":
            return "success";
        default:
            return "neutral";
    }
};