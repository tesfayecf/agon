import { useEffect, useState, type ReactElement } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchActivityFileById, updateActivityFileMetadata, type ActivityFile } from "./activity.service";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { TrackCanvasView } from "./TrackCanvasView";

export const TrackDetailPage = (): ReactElement => {
    const { id } = useParams<{ id: string }>();
    const [file, setFile] = useState<ActivityFile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");

    useEffect(() => {
        if (!id) return;
        fetchActivityFileById(id)
            .then((res) => {
                setFile(res);
                setName(res.name || res.filename);
                setDescription(res.description || "");
                setTags(res.tags || "");
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [id]);

    const handleSave = async () => {
        if (!id) return;
        const updated = await updateActivityFileMetadata(id, { name, description, tags });
        setFile(updated);
        setIsEditing(false);
    };

    if (isLoading) return <p className="panel__copy" style={{ padding: "2rem" }}>Loading…</p>;
    if (!file) return <div className="error-banner">Training not found</div>;

    return (
        <section className="upload-grid" aria-live="polite">
            <article className="upload-panel" style={{ gridColumn: "span 12" }}>
                <div className="panel__header">
                    <div>
                        <Link to="/tracks" style={{ fontSize: "0.85rem", color: "var(--accent)", textDecoration: "none" }}>← Back</Link>
                        <h2>{isEditing ? "Edit Training" : (file.name || file.filename)}</h2>
                    </div>
                    <div>
                        {isEditing ? (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
                                <button type="button" className="button-link--primary" onClick={handleSave}>Save</button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setIsEditing(true)}>Edit</button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ width: "100%", padding: "0.5rem" }} />
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} style={{ width: "100%", padding: "0.5rem" }} />
                        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" style={{ width: "100%", padding: "0.5rem" }} />
                    </div>
                ) : (
                    <div style={{ marginTop: "1rem" }}>
                        {file.description && <p className="panel__copy">{file.description}</p>}
                        {file.tags && <p style={{ fontSize: "0.85rem", color: "var(--accent)" }}>Tags: {file.tags}</p>}
                    </div>
                )}

                <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span>Distance</span>
                        <strong>{file.distanceMeters ? `${(file.distanceMeters / 1000).toFixed(2)} km` : "N/A"}</strong>
                    </article>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span>Duration</span>
                        <strong>{file.durationSeconds ? `${(file.durationSeconds / 60).toFixed(1)} min` : "N/A"}</strong>
                    </article>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span>Elevation</span>
                        <strong>{file.elevationGain ? `${file.elevationGain.toFixed(0)} m` : "N/A"}</strong>
                    </article>
                    <article style={{ background: "rgba(15, 118, 110, 0.05)", padding: "1rem", borderRadius: "1rem" }}>
                        <span>Avg HR</span>
                        <strong>{file.avgHeartRate ? `${file.avgHeartRate.toFixed(0)} bpm` : "N/A"}</strong>
                    </article>
                </div>

                {file.records && file.records.length > 0 && (
                    <>
                        <TimeSeriesChart records={file.records} />
                        <TrackCanvasView records={file.records} />
                    </>
                )}
            </article>
        </section>
    );
};
