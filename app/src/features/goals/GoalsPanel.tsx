import { useState, type FormEvent, type ReactElement } from "react";

import { createGoal, deleteGoal, updateGoal, type GoalType, type GoalWithProgress } from "./goals.service";
import { EmptyState } from "../../shared/components/StateViews";
import { ProgressRing } from "../../shared/components/ProgressRing";
import { formatDayMonth, formatDistance } from "../../shared/utils/format";

interface GoalsPanelProps {
    goals: GoalWithProgress[];
    onChanged: () => void;
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    weekly_distance: "Weekly goal",
    monthly_distance: "Monthly goal",
};

const shortDate = (value: string): string => {
    const label = formatDayMonth(value);
    return label === "—" ? value : label;
};

export const GoalsPanel = ({ goals, onChanged }: GoalsPanelProps): ReactElement => {
    const [isAdding, setIsAdding] = useState(false);
    const [type, setType] = useState<GoalType>("weekly_distance");
    const [targetKm, setTargetKm] = useState("40");
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        const km = Number(targetKm);
        if (!Number.isFinite(km) || km <= 0) {
            setError("Enter a target distance greater than zero.");
            return;
        }
        setError(null);
        try {
            await createGoal({ type, targetMeters: km * 1000 });
            setIsAdding(false);
            setTargetKm("40");
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create goal.");
        }
    };

    const handleDeactivate = async (goal: GoalWithProgress) => {
        setBusyId(goal.id);
        try {
            await updateGoal(goal.id, { targetMeters: goal.targetMeters, active: false });
            onChanged();
        } catch {
            /* surfaced via the list not refreshing; acceptable for this lightweight iteration */
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (goal: GoalWithProgress) => {
        setBusyId(goal.id);
        try {
            await deleteGoal(goal.id);
            onChanged();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="goals-panel">
            {goals.length === 0 && !isAdding && (
                <EmptyState title="No active goals" message="Set a weekly or monthly distance target to track progress here." />
            )}

            {goals.length > 0 && (
                <ul className="goal-list">
                    {goals.map((goal) => {
                        const isComplete = goal.percentComplete >= 100;
                        return (
                            <li key={goal.id} className={`goal-card${isComplete ? " goal-card--complete" : ""}`}>
                                <ProgressRing
                                    percent={goal.percentComplete}
                                    color={isComplete ? "var(--success)" : "var(--accent)"}
                                    label={`${GOAL_TYPE_LABELS[goal.type]} ${Math.round(goal.percentComplete)}% complete`}
                                />

                                <div className="goal-card__body">
                                    <div className="goal-card__title-row">
                                        <strong className="goal-card__title">{GOAL_TYPE_LABELS[goal.type]}</strong>
                                        <div className="goal-card__actions">
                                            <button
                                                type="button"
                                                className="icon-btn"
                                                title="Deactivate goal"
                                                aria-label={`Deactivate ${GOAL_TYPE_LABELS[goal.type]} goal`}
                                                disabled={busyId === goal.id}
                                                onClick={() => handleDeactivate(goal)}
                                            >
                                                ⏻
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-btn icon-btn--danger"
                                                title="Remove goal"
                                                aria-label={`Remove ${GOAL_TYPE_LABELS[goal.type]} goal`}
                                                disabled={busyId === goal.id}
                                                onClick={() => handleDelete(goal)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <p className="goal-card__figure">
                                        <strong>{formatDistance(goal.achievedMeters)}</strong>
                                        <span> / {formatDistance(goal.targetMeters)}</span>
                                    </p>

                                    <p className="goal-card__meta">
                                        {isComplete ? "Target reached" : `${formatDistance(goal.remainingMeters)} to go`}
                                        <span className="goal-card__dot" aria-hidden="true">
                                            ·
                                        </span>
                                        {shortDate(goal.periodStart)} – {shortDate(goal.periodEnd)}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {isAdding ? (
                <form className="goal-form" onSubmit={handleCreate}>
                    <div className="form-field">
                        <label htmlFor="goal-type">Goal type</label>
                        <select id="goal-type" value={type} onChange={(e) => setType(e.target.value as GoalType)}>
                            <option value="weekly_distance">Weekly distance</option>
                            <option value="monthly_distance">Monthly distance</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label htmlFor="goal-target">Target distance (km)</label>
                        <input id="goal-target" type="number" min="0.1" step="0.1" value={targetKm} onChange={(e) => setTargetKm(e.target.value)} />
                    </div>
                    {error !== null && <p className="error-banner">{error}</p>}
                    <div className="goal-form__actions">
                        <button type="submit" className="btn btn-primary btn-sm">
                            Save goal
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setIsAdding(false)}>
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <button type="button" className="btn btn-sm goals-panel__add" onClick={() => setIsAdding(true)}>
                    + Add goal
                </button>
            )}
        </div>
    );
};
