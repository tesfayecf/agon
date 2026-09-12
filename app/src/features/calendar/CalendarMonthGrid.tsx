import type { ReactElement } from "react";
import type { ActivityFile } from "../activity/activity.service";
import { getMonthMatrix, getWeekdayLabels } from "./calendar.utils";
import { formatDistance } from "../../shared/utils/format";

const MAX_VISIBLE_ENTRIES = 3;

interface CalendarMonthGridProps {
    year: number;
    month: number;
    activitiesByDate: Map<string, ActivityFile[]>;
    onSelectTraining: (id: string) => void;
}

export const CalendarMonthGrid = ({ year, month, activitiesByDate, onSelectTraining }: CalendarMonthGridProps): ReactElement => {
    const days = getMonthMatrix(year, month);
    const weekdays = getWeekdayLabels();

    return (
        <>
            <div className="calendar__weekdays">
                {weekdays.map((label) => (
                    <div key={label} className="calendar__weekday">
                        {label}
                    </div>
                ))}
            </div>
            <div className="calendar__grid">
                {days.map((day) => {
                    const entries = activitiesByDate.get(day.key) ?? [];
                    const visible = entries.slice(0, MAX_VISIBLE_ENTRIES);
                    const overflow = entries.length - visible.length;
                    const classes = [
                        "calendar__day",
                        day.isCurrentMonth ? "" : "calendar__day--outside",
                        day.isToday ? "calendar__day--today" : "",
                    ]
                        .filter(Boolean)
                        .join(" ");

                    return (
                        <div key={day.key} className={classes}>
                            <span className="calendar__day-number">{day.date.getDate()}</span>
                            {entries.length > 0 && (
                                <div className="calendar__entries">
                                    {visible.map((file) => (
                                        <button
                                            key={file.id}
                                            type="button"
                                            className="calendar__chip"
                                            title={`${file.name ?? file.filename} · ${formatDistance(file.distanceMeters)}`}
                                            onClick={() => onSelectTraining(file.id)}
                                        >
                                            {file.name ?? file.filename}
                                            {file.distanceMeters !== undefined && file.distanceMeters > 0
                                                ? ` · ${formatDistance(file.distanceMeters)}`
                                                : ""}
                                        </button>
                                    ))}
                                    {overflow > 0 && <span className="calendar__chip-more">+{overflow} more</span>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
};
