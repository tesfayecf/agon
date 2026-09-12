import { useEffect, useState, type ReactElement } from "react";

import { fetchTemplate, saveTemplate, type ScheduleSlot } from "./schedule.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, ErrorState } from "../../shared/components/StateViews";

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const emptyWeek = (): ScheduleSlot[] =>
    Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, trainingType: "Rest", title: "", targetDistanceMeters: 0 }));

export const SchedulePage = (): ReactElement => {
    const [slots, setSlots] = useState<ScheduleSlot[]>(emptyWeek());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplate()
            .then((res) => {
                const byDay = new Map(res.days.map((d) => [d.dayOfWeek, d]));
                setSlots(emptyWeek().map((fallback) => byDay.get(fallback.dayOfWeek) ?? fallback));
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load the weekly schedule."))
            .finally(() => setIsLoading(false));
    }, []);

    const updateSlot = (dayOfWeek: number, patch: Partial<ScheduleSlot>) => {
        setSlots((prev) => prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, ...patch } : s)));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSavedMessage(null);
        setError(null);
        try {
            await saveTemplate(slots);
            setSavedMessage("Weekly schedule saved.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the weekly schedule.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section aria-live="polite">
            <PageHeader
                eyebrow="Planning"
                title="Weekly Schedule"
                subtitle="Define a reusable template for a typical training week. It's used to plan calendar weeks that don't have a specific override."
                actions={
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? "Saving…" : "Save schedule"}
                    </button>
                }
            />

            {isLoading && (
                <Card>
                    <LoadingState label="Loading weekly schedule…" />
                </Card>
            )}

            {!isLoading && (
                <Card>
                    {error !== null && <ErrorState message={error} />}
                    {savedMessage !== null && <p className="state-block__message" style={{ color: "var(--success)" }}>{savedMessage}</p>}

                    <div className="schedule-editor">
                        {slots.map((slot) => (
                            <div key={slot.dayOfWeek} className="schedule-editor__row">
                                <span className="schedule-editor__day">{WEEKDAY_LABELS[slot.dayOfWeek]}</span>
                                <select
                                    value={slot.trainingType ?? "Rest"}
                                    onChange={(e) => updateSlot(slot.dayOfWeek, { trainingType: e.target.value })}
                                    aria-label={`${WEEKDAY_LABELS[slot.dayOfWeek]} training type`}
                                >
                                    <option>Rest</option>
                                    <option>Easy</option>
                                    <option>Intervals</option>
                                    <option>Tempo</option>
                                    <option>Long run</option>
                                    <option>Race</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Title (optional)"
                                    value={slot.title ?? ""}
                                    onChange={(e) => updateSlot(slot.dayOfWeek, { title: e.target.value })}
                                    aria-label={`${WEEKDAY_LABELS[slot.dayOfWeek]} title`}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    placeholder="km"
                                    value={slot.targetDistanceMeters ? slot.targetDistanceMeters / 1000 : ""}
                                    onChange={(e) => updateSlot(slot.dayOfWeek, { targetDistanceMeters: e.target.value ? Number(e.target.value) * 1000 : 0 })}
                                    aria-label={`${WEEKDAY_LABELS[slot.dayOfWeek]} target distance in km`}
                                />
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </section>
    );
};
