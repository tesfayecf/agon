import { useEffect, useState, type ReactElement } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchActivityFileById, updateActivityFileMetadata, type ActivityFile } from "./activity.service";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { TrackCanvasView } from "./TrackCanvasView";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { LoadingState, ErrorState } from "../../shared/components/StateViews";
import { formatDate, formatDistance, formatDuration, formatElevation, formatHeartRate } from "../../shared/utils/format";

export const TrackDetailPage = (): ReactElement => {
    const { id } = useParams<{ id: string }>();
    const [file, setFile] = useState<ActivityFile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");

    useEffect(() => {
        if (!id) return;
        setIsLoading(true);
        fetchActivityFileById(id)
            .then((res) => {
                setFile(res);
                setName(res.name || res.filename);
                setDescription(res.description || "");
                setTags(res.tags || "");
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load training."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleSave = async () => {
        if (!id) return;
        try {
            const updated = await updateActivityFileMetadata(id, { name, description, tags });
            setFile(updated);
            setIsEditing(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update metadata");
        }
    };

    if (isLoading) {
        return (
            <Card>
                <LoadingState label="Loading training…" />
            </Card>
        );
    }

    if (error !== null) {
        return <ErrorState message={error} />;
    }

    if (!file) {
        return <ErrorState message="Training not found." />;
    }

    return (
        <section aria-live="polite">
            <Card>
                <div className="page-header">
                    <div>
                        <Link to="/tracks" className="card__link">
                            ← Back to trainings
                        </Link>
                        <h1 className="page-header__title" style={{ marginTop: "0.4rem" }}>
                            {isEditing ? "Edit training" : file.name || file.filename}
                        </h1>
                    </div>
                    <div className="page-header__actions">
                        {isEditing ? (
                            <>
                                <button type="button" className="btn btn-sm" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
                                    Save
                                </button>
                            </>
                        ) : (
                            <button type="button" className="btn btn-sm" onClick={() => setIsEditing(true)}>
                                Edit
                            </button>
                        )}
                    </div>
                </div>

                {file.status === "error" && <ErrorState message={file.error ?? "This file could not be processed."} />}

                {isEditing ? (
                    <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem", maxWidth: "32rem" }}>
                        <div className="form-field">
                            <label htmlFor="track-name">Name</label>
                            <input id="track-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="form-field">
                            <label htmlFor="track-description">Description</label>
                            <textarea id="track-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </div>
                        <div className="form-field">
                            <label htmlFor="track-tags">Tags (comma-separated)</label>
                            <input id="track-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: "1rem" }}>
                        <p style={{ color: "var(--muted)", margin: 0 }}>{formatDate(file.activityDate)}</p>
                        {file.description && <p style={{ marginTop: "0.5rem" }}>{file.description}</p>}
                        {file.tags && <p style={{ fontSize: "0.85rem", color: "var(--accent)", marginTop: "0.4rem" }}>Tags: {file.tags}</p>}
                    </div>
                )}

                <div className="metric-grid" style={{ marginTop: "1.25rem" }}>
                    <MetricCard label="Distance" value={formatDistance(file.distanceMeters)} isAvailable={(file.distanceMeters ?? 0) > 0} />
                    <MetricCard label="Duration" value={formatDuration(file.durationSeconds)} isAvailable={(file.durationSeconds ?? 0) > 0} />
                    <MetricCard label="Elevation" value={formatElevation(file.elevationGain)} isAvailable={(file.elevationGain ?? 0) > 0} />
                    <MetricCard label="Avg heart rate" value={formatHeartRate(file.avgHeartRate)} isAvailable={(file.avgHeartRate ?? 0) > 0} />
                </div>

                {file.records && file.records.length > 0 && (
                    <>
                        <TimeSeriesChart records={file.records} />
                        <TrackCanvasView records={file.records} />
                    </>
                )}

                {(!file.records || file.records.length === 0) && file.status === "success" && (
                    <p style={{ marginTop: "1rem", color: "var(--muted)" }}>This file parsed but did not contain track records.</p>
                )}
            </Card>
        </section>
    );
};
