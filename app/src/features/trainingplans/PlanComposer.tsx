import { useMemo, useState, type ReactElement } from "react";

import { createTrainingPlan, type TrainingPlanSession } from "./trainingplans.service";
import { Card } from "../../shared/components/Card";
import { ErrorState } from "../../shared/components/StateViews";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const INTENSITIES = ["", "easy", "moderate", "hard", "recovery"];
const TYPES = ["", "run", "bike", "swim", "strength", "walk", "rest"];

interface PlanComposerProps {
    onCreated: (planId: string) => void;
    onCancel: () => void;
}

interface DraftSession {
    key: number;
    weekNumber: number;
    dayOfWeek: number;
    trainingType: string;
    title: string;
    targetDistanceMeters?: number;
    targetDurationSeconds?: number;
    targetPaceSecondsPerKm?: number;
    intensity: string;
    notes: string;
}

const blankSession = (key: number, weekNumber = 1, dayOfWeek = 0): DraftSession => ({
    key,
    weekNumber,
    dayOfWeek,
    trainingType: "run",
    title: "",
    targetDistanceMeters: undefined,
    targetDurationSeconds: undefined,
    targetPaceSecondsPerKm: undefined,
    intensity: "easy",
    notes: "",
});

/** Best-effort metres|seconds|pace conversions for numeric inputs in km/min/sec. */
const toSession = (key: number, patch: Partial<DraftSession>): DraftSession =>
    ({ ...blankSession(key), ...patch });

export const PlanComposer = ({ onCreated, onCancel }: PlanComposerProps): ReactElement => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [reasoning, setReasoning] = useState("");
    const [weekCount, setWeekCount] = useState(4);
    const [startDate, setStartDate] = useState("");
    const [sessions, setSessions] = useState<DraftSession[]>([blankSession(0)]);
    const [importText, setImportText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [nextKey, setNextKey] = useState(1);

    const updateSession = (key: number, patch: Partial<DraftSession>) => {
        setSessions((prev) => prev.map((s) => (s.key === key ? toSession(key, { ...s, ...patch }) : s)));
    };

    const removeSession = (key: number) => {
        setSessions((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
    };

    const addSession = () => {
        const last = sessions[sessions.length - 1];
        setSessions((prev) => [...prev, blankSession(nextKey, last?.weekNumber ?? 1, (last?.dayOfWeek ?? -1) + 1)]);
        setNextKey((k) => k + 1);
    };

    const handleImport = () => {
        try {
            const parsed = JSON.parse(importText);
            // Accept either { plan, sessions } or { title, weekCount, sessions } (MCP tool output shape).
            const plan = parsed.plan ?? parsed;
            const importedSessions: unknown[] = parsed.sessions ?? plan.sessions ?? [];
            if (typeof plan.title === "string") setTitle(plan.title);
            if (typeof plan.description === "string") setDescription(plan.description);
            if (typeof plan.reasoning === "string") setReasoning(plan.reasoning);
            if (typeof plan.weekCount === "number") setWeekCount(plan.weekCount);
            if (typeof plan.startDate === "string") setStartDate(plan.startDate);

            const next: DraftSession[] = importedSessions.map((raw, i) => {
                const s = raw as Record<string, unknown>;
                return toSession(i, {
                    weekNumber: typeof s.weekNumber === "number" ? s.weekNumber : 1,
                    dayOfWeek: typeof s.dayOfWeek === "number" ? s.dayOfWeek : 0,
                    trainingType: typeof s.trainingType === "string" ? s.trainingType : "run",
                    title: typeof s.title === "string" ? s.title : "",
                    targetDistanceMeters: typeof s.targetDistanceMeters === "number" ? s.targetDistanceMeters : undefined,
                    targetDurationSeconds: typeof s.targetDurationSeconds === "number" ? s.targetDurationSeconds : undefined,
                    targetPaceSecondsPerKm: typeof s.targetPaceSecondsPerKm === "number" ? s.targetPaceSecondsPerKm : undefined,
                    intensity: typeof s.intensity === "string" ? s.intensity : "easy",
                    notes: typeof s.notes === "string" ? s.notes : "",
                });
            });
            if (next.length > 0) setSessions(next.length > 0 ? next : [blankSession(0)]);
            setNextKey(next.length + 1);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? `Could not parse JSON: ${err.message}` : "Could not parse JSON.");
        }
    };

    const payload = useMemo(
        () => ({
            plan: {
                title: title.trim(),
                description: description.trim(),
                reasoning: reasoning.trim(),
                weekCount,
                startDate: startDate || undefined,
            },
            sessions: sessions
                .filter((s) => s.title.trim() !== "" || (s.targetDistanceMeters ?? 0) > 0 || (s.targetDurationSeconds ?? 0) > 0)
                .map((s, i): TrainingPlanSession => ({
                    weekNumber: s.weekNumber,
                    dayOfWeek: s.dayOfWeek,
                    trainingType: s.trainingType || undefined,
                    title: s.title.trim() || undefined,
                    targetDistanceMeters: s.targetDistanceMeters,
                    targetDurationSeconds: s.targetDurationSeconds,
                    targetPaceSecondsPerKm: s.targetPaceSecondsPerKm,
                    intensity: s.intensity || undefined,
                    notes: s.notes.trim() || undefined,
                    sortOrder: i,
                })),
        }),
        [title, description, reasoning, weekCount, startDate, sessions],
    );

    const handleSubmit = async () => {
        if (payload.plan.title === "") {
            setError("Title is required.");
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const created = await createTrainingPlan(payload);
            onCreated(created.plan.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the training plan.");
            setIsSaving(false);
        }
    };

    return (
        <Card
            title="New training plan"
            eyebrow="Coach"
            accent="var(--accent)"
            actions={
                <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={isSaving || title.trim() === ""}>
                        {isSaving ? "Creating…" : "Create plan"}
                    </button>
                </>
            }
        >
            {error !== null && <ErrorState message={error} />}

            <details className="plan-importer">
                <summary>Import from AI (paste JSON)</summary>
                <p className="plan-importer__hint">
                    Paste the JSON returned by the MCP{" "}
                    <code>generate_training_plan</code> tool (or a <code>{"{ plan, sessions }"}</code> object) to prefill the
                    form.
                </p>
                <textarea
                    className="plan-importer__field"
                    rows={4}
                    placeholder='{"title":"Marathon build","weekCount":4,"sessions":[{"weekNumber":1,"dayOfWeek":1,"trainingType":"run","title":"Easy 8k","targetDistanceMeters":8000,"intensity":"easy"}]}'
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleImport} disabled={importText.trim() === ""}>
                    Prefill form from JSON
                </button>
            </details>

            <div className="composer-grid">
                <div className="form-field">
                    <label htmlFor="plan-title">Title *</label>
                    <input
                        id="plan-title"
                        type="text"
                        placeholder="e.g. Marathon base build — 4 weeks"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div className="form-field">
                    <label htmlFor="plan-weeks">Weeks (1–16)</label>
                    <input
                        id="plan-weeks"
                        type="number"
                        min={1}
                        max={16}
                        value={weekCount}
                        onChange={(e) => setWeekCount(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
                    />
                </div>
                <div className="form-field">
                    <label htmlFor="plan-start">Start date</label>
                    <input
                        id="plan-start"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="form-field form-field--wide">
                    <label htmlFor="plan-desc">Description</label>
                    <input
                        id="plan-desc"
                        type="text"
                        placeholder="Purpose and approach"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <div className="form-field form-field--wide">
                    <label htmlFor="plan-reasoning">AI reasoning</label>
                    <textarea
                        id="plan-reasoning"
                        rows={3}
                        placeholder="Analysis of past training and rationale for this plan"
                        value={reasoning}
                        onChange={(e) => setReasoning(e.target.value)}
                    />
                </div>
            </div>

            <div className="composer-sessions">
                <div className="composer-sessions__header">
                    <h3>Sessions</h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addSession}>
                        + Add session
                    </button>
                </div>

                {sessions.map((s) => (
                    <div key={s.key} className="plan-session-row">
                        <span className="plan-session-row__index" aria-hidden="true">
                            {String(s.dayOfWeek + 1).padStart(2, "0")}
                        </span>
                        <input
                            className="plan-session-row__week"
                            type="number"
                            min={1}
                            title="Week number"
                            aria-label={`Session ${s.key + 1} week number`}
                            value={s.weekNumber}
                            onChange={(e) => updateSession(s.key, { weekNumber: Math.max(1, Number(e.target.value) || 1) })}
                        />
                        <select
                            className="plan-session-row__day"
                            aria-label={`Session ${s.key + 1} day of week`}
                            value={s.dayOfWeek}
                            onChange={(e) => updateSession(s.key, { dayOfWeek: Number(e.target.value) })}
                        >
                            {WEEKDAY_LABELS.map((label, day) => (
                                <option key={day} value={day}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <select
                            className="plan-session-row__type"
                            aria-label={`Session ${s.key + 1} type`}
                            value={s.trainingType}
                            onChange={(e) => updateSession(s.key, { trainingType: e.target.value })}
                        >
                            {TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t || "—"}
                                </option>
                            ))}
                        </select>
                        <input
                            className="plan-session-row__title"
                            type="text"
                            placeholder="Title"
                            aria-label={`Session ${s.key + 1} title`}
                            value={s.title}
                            onChange={(e) => updateSession(s.key, { title: e.target.value })}
                        />
                        <input
                            className="plan-session-row__num"
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder="km"
                            aria-label={`Session ${s.key + 1} distance in km`}
                            value={s.targetDistanceMeters !== undefined ? s.targetDistanceMeters / 1000 : ""}
                            onChange={(e) =>
                                updateSession(s.key, {
                                    targetDistanceMeters: e.target.value !== "" ? Math.round(Number(e.target.value) * 1000) : undefined,
                                })
                            }
                        />
                        <input
                            className="plan-session-row__num"
                            type="number"
                            min={0}
                            step="1"
                            placeholder="min"
                            aria-label={`Session ${s.key + 1} duration in minutes`}
                            value={s.targetDurationSeconds !== undefined ? Math.round(s.targetDurationSeconds / 60) : ""}
                            onChange={(e) =>
                                updateSession(s.key, {
                                    targetDurationSeconds: e.target.value !== "" ? Number(e.target.value) * 60 : undefined,
                                })
                            }
                        />
                        <select
                            className="plan-session-row__intensity"
                            aria-label={`Session ${s.key + 1} intensity`}
                            value={s.intensity}
                            onChange={(e) => updateSession(s.key, { intensity: e.target.value })}
                        >
                            {INTENSITIES.map((i) => (
                                <option key={i} value={i}>
                                    {i || "—"}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="plan-session-row__remove"
                            aria-label={`Remove session ${s.key + 1}`}
                            title="Remove session"
                            onClick={() => removeSession(s.key)}
                            disabled={sessions.length <= 1}
                        >
                            ✕
                        </button>
                    </div>
                ))}
                <p className="composer-sessions__hint">
                    Sessions without a title or target are ignored on save. Use the AI tool output to prefill.
                </p>
            </div>
        </Card>
    );
};