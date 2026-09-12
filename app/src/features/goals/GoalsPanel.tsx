import { useState, type FormEvent, type ReactElement } from "react";

import { createGoal, deleteGoal, updateGoal, type GoalType, type GoalWithProgress } from "./goals.service";
import { EmptyState } from "../../shared/components/StateViews";
import { formatDistance } from "../../shared/utils/format";

interface GoalsPanelProps {
    goals: GoalWithProgress[];
    onChanged: () => void;
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    weekly_distance: "Weekly distance",
    monthly_distance: "Monthly distance",
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
            /* surfaced via list not refreshing; acceptable for this lightweight iteration */
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
        <div>
            {goals.length === 0 && !isAdding && (
                <EmptyState title="No active goals" message="Define a weekly or monthly distance goal to track progress." />
            )}

            {goals.length > 0 && (
                <ul className="goal-list">
                    {goals.map((goal) => (
                        <li key={goal.id} className="goal-list__item">
                            <div className="goal-list__header">
                                <strong>{GOAL_TYPE_LABELS[goal.type]}</strong>
                                <span className="goal-list__period">{goal.periodStart} → {goal.periodEnd}</span>
                            </div>
                            <div className="goal-progress">
                                <div className="goal-progress__bar">
                                    <div
                                        className="goal-progress__fill"
                                        style={{ width: `${Math.min(100, goal.percentComplete)}%` }}
                                    />
                                </div>
                                <span className="goal-progress__label">{goal.percentComplete.toFixed(0)}%</span>
                            </div>
                            <div className="goal-list__stats">
                                <span>{formatDistance(goal.achievedMeters)} of {formatDistance(goal.targetMeters)}</span>
                                <span>{formatDistance(goal.remainingMeters)} remaining</span>
                            </div>
                            <div className="goal-list__actions">
                                <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === goal.id} onClick={() => handleDeactivate(goal)}>
                                    Deactivate
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === goal.id} onClick={() => handleDelete(goal)}>
                                    Remove
                                </button>
                            </div>
                        </li>
                    ))}
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
                        <button type="submit" className="btn btn-primary btn-sm">Save goal</button>
                        <button type="button" className="btn btn-sm" onClick={() => setIsAdding(false)}>Cancel</button>
                    </div>
                </form>
            ) : (
                <button type="button" className="btn btn-sm" style={{ marginTop: "0.75rem" }} onClick={() => setIsAdding(true)}>
                    + Add goal
                </button>
            )}
        </div>
    );
};
