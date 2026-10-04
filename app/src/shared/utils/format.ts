export const formatDistance = (meters?: number): string => {
    if (meters === undefined || meters <= 0) return "—";
    return `${(meters / 1000).toFixed(2)} km`;
};

export const formatDuration = (seconds?: number): string => {
    if (seconds === undefined || seconds <= 0) return "—";
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
};

export const formatElevation = (meters?: number): string => {
    if (meters === undefined || meters <= 0) return "—";
    return `${meters.toFixed(0)} m`;
};

export const formatHeartRate = (bpm?: number): string => {
    if (bpm === undefined || bpm <= 0) return "—";
    return `${bpm.toFixed(0)} bpm`;
};

export const formatPace = (secondsPerKm?: number): string => {
    if (secondsPerKm === undefined || secondsPerKm <= 0 || !Number.isFinite(secondsPerKm)) return "—";
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.round(secondsPerKm % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
};

export const formatTime = (seconds?: number): string => {
    if (seconds === undefined || seconds <= 0) return "—";
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Date-only strings ("2026-10-06") are calendar days, so parse them as local time rather than UTC. */
const toDate = (value: Date | string | undefined): Date | null => {
    if (value === undefined || value === "") return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = dayOnly ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3])) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** DD/MM/YYYY, regardless of the browser's locale. */
export const formatDate = (value?: Date | string): string => {
    const date = toDate(value);
    if (date === null) return "—";
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

/** DD/MM, for compact labels where the year is implied. */
export const formatDayMonth = (value?: Date | string): string => {
    const date = toDate(value);
    if (date === null) return "—";
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
};

/** DD/MM/YYYY HH:mm (24-hour). */
export const formatDateTime = (value?: Date | string): string => {
    const date = toDate(value);
    if (date === null) return "—";
    return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
