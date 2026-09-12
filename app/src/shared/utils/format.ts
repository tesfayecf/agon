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

export const formatDate = (value?: string): string => {
    if (value === undefined || value === "") return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
