import type { ReactElement } from "react";
import type { ActivityFile } from "../activity/activity.service";
import { getMonthMatrix, getWeekdayLabels, groupActivitiesByDate } from "./calendar.utils";

interface CalendarMiniPreviewProps {
    files: ActivityFile[];
}

export const CalendarMiniPreview = ({ files }: CalendarMiniPreviewProps): ReactElement => {
    const today = new Date();
    const activitiesByDate = groupActivitiesByDate(files);
    const days = getMonthMatrix(today.getFullYear(), today.getMonth(), today);
    const weekdays = getWeekdayLabels();

    return (
        <div>
            <div className="calendar-mini" style={{ marginBottom: "0.3rem" }}>
                {weekdays.map((label) => (
                    <div key={label} style={{ textAlign: "center", fontSize: "0.68rem", color: "var(--muted)", fontWeight: 700 }}>
                        {label.slice(0, 2)}
                    </div>
                ))}
            </div>
            <div className="calendar-mini">
                {days.map((day) => {
                    const hasActivity = (activitiesByDate.get(day.key)?.length ?? 0) > 0;
                    const classes = [
                        "calendar-mini__day",
                        day.isCurrentMonth ? "" : "calendar-mini__day--outside",
                        hasActivity ? "calendar-mini__day--active" : "",
                        day.isToday ? "calendar-mini__day--today" : "",
                    ]
                        .filter(Boolean)
                        .join(" ");
                    return (
                        <div key={day.key} className={classes} title={day.date.toDateString()}>
                            {day.date.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
