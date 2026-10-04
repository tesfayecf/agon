import { useState, type FormEvent, type ReactElement } from "react";

import type { CalendarDayView } from "../schedule/schedule.service";
import { createPlannedSession, deletePlannedSession } from "../schedule/schedule.service";
import { Badge } from "../../shared/components/Badge";
import { formatDayMonth, formatDistance } from "../../shared/utils/format";

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface CalendarWeekAgendaProps {
    days: CalendarDayView[];
    onSelectTraining: (id: string) => void;
    onChanged: () => void;
}

export const CalendarWeekAgenda = ({ days, onSelectTraining, onChanged }: CalendarWeekAgendaProps): ReactElement => {
    const [addingFor, setAddingFor] = useState<string | null>(null);

    return (
        <div className="week-agenda">
            {days.map((day, idx) => (
                <div key={day.date} className={`week-agenda__day${day.isToday ? " week-agenda__day--today" : ""}`}>
                    <div className="week-agenda__day-header">
                        <span className="week-agenda__weekday">{WEEKDAY_LABELS[idx]}</span>
                        <span className="week-agenda__date">{formatDayMonth(day.date)}</span>
                    </div>

                    <div className="week-agenda__entries">
                        {day.completed.map((act) => (
                            <button key={act.id} type="button" className="week-agenda__entry week-agenda__entry--completed" onClick={() => onSelectTraining(act.id)}>
                                <Badge tone="success">✓ Completed</Badge>
                                <div className="week-agenda__entry-body">
                                    <strong>{act.name || act.filename}</strong>
                                    {act.distanceMeters !== undefined && act.distanceMeters > 0 && <small>{formatDistance(act.distanceMeters)}</small>}
                                </div>
                            </button>
                        ))}

                        {day.planned.map((p, pIdx) => (
                            <div key={p.id ?? `template-${pIdx}`} className="week-agenda__entry week-agenda__entry--planned">
                                <Badge tone={p.isCompleted ? "success" : p.isTemplateDefault ? "neutral" : "warning"}>
                                    {p.isCompleted ? "✓ Done" : p.isTemplateDefault ? "◌ Template" : "○ Planned"}
                                </Badge>
                                <div className="week-agenda__entry-body">
                                    <strong>{p.title || p.trainingType || "Planned session"}</strong>
                                    <small>
                                        {p.trainingType ? `${p.trainingType} · ` : ""}
                                        {p.targetDistanceMeters !== undefined && p.targetDistanceMeters > 0 ? formatDistance(p.targetDistanceMeters) : "No target set"}
                                    </small>
                                </div>
                                {p.id !== undefined && (
                                    <button
                                        type="button"
                                        className="week-agenda__remove"
                                        aria-label="Remove planned session"
                                        onClick={async () => {
                                            await deletePlannedSession(p.id as string);
                                            onChanged();
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}

                        {day.completed.length === 0 && day.planned.length === 0 && (
                            <p className="week-agenda__empty">Nothing scheduled</p>
                        )}
                    </div>

                    {addingFor === day.date ? (
                        <PlannedSessionForm
                            date={day.date}
                            onCancel={() => setAddingFor(null)}
                            onSaved={() => {
                                setAddingFor(null);
                                onChanged();
                            }}
                        />
                    ) : (
                        <button type="button" className="btn btn-ghost btn-sm week-agenda__add" onClick={() => setAddingFor(day.date)}>
                            + Plan session
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

const PlannedSessionForm = ({
    date,
    onCancel,
    onSaved,
}: {
    date: string;
    onCancel: () => void;
    onSaved: () => void;
}): ReactElement => {
    const [trainingType, setTrainingType] = useState("Easy");
    const [title, setTitle] = useState("");
    const [distanceKm, setDistanceKm] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await createPlannedSession({
                date,
                trainingType,
                title: title.trim() || undefined,
                targetDistanceMeters: distanceKm.trim() !== "" ? Number(distanceKm) * 1000 : undefined,
            });
            onSaved();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form className="week-agenda__form" onSubmit={handleSubmit}>
            <select value={trainingType} onChange={(e) => setTrainingType(e.target.value)} aria-label="Training type">
                <option>Rest</option>
                <option>Easy</option>
                <option>Intervals</option>
                <option>Tempo</option>
                <option>Long run</option>
                <option>Race</option>
            </select>
            <input type="text" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            <input type="number" min="0" step="0.1" placeholder="km" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} aria-label="Target distance (km)" />
            <div className="week-agenda__form-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>Save</button>
                <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
};
