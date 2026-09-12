import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { fetchActivityFiles, uploadActivityFiles, type ActivityFile } from "../activity/activity.service";

export const TracksPage = (): ReactElement => {
    const [files, setFiles] = useState<ActivityFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = () => {
        setIsLoading(true);
        fetchActivityFiles()
            .then((res) => setFiles(res.files || []))
            .catch(() => {})
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextFiles = e.target.files;
        if (!nextFiles || nextFiles.length === 0) return;
        setIsUploading(true);
        setError(null);
        try {
            await uploadActivityFiles(nextFiles);
            loadFiles();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    return (
        <section className="upload-grid" aria-live="polite">
            <article className="upload-panel" style={{ gridColumn: "span 12" }}>
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Workouts</p>
                        <h2>Training Tracks</h2>
                    </div>
                    <label className="button-link button-link--primary" style={{ cursor: "pointer", padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
                        <span>{isUploading ? "Uploading..." : "+ Upload Track"}</span>
                        <input type="file" multiple accept=".fit,.tcx" onChange={handleUpload} style={{ display: "none" }} />
                    </label>
                </div>
                {error && <div className="error-banner">{error}</div>}
            </article>

            <article className="upload-list" style={{ gridColumn: "span 12", marginTop: "1rem" }}>
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Library</p>
                        <h3>All Uploaded Trainings</h3>
                    </div>
                </div>

                {isLoading && <p className="panel__copy">Loading trainings…</p>}
                {!isLoading && files.length === 0 && <p className="panel__copy">No trainings uploaded yet. Click "+ Upload Track" above.</p>}
                {!isLoading && files.length > 0 && (
                    <ul className="file-list">
                        {files.map((file) => (
                            <li key={file.id}>
                                <Link to={`/tracks/${file.id}`} className="file-list__item" style={{ textDecoration: "none" }}>
                                    <div className="file-meta">
                                        <strong>{file.name || file.filename}</strong>
                                        <small>{file.activityDate ? new Date(file.activityDate).toLocaleString() : file.filename} {file.tags ? `· Tagged: ${file.tags}` : ""}</small>
                                    </div>
                                    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                                        {file.distanceMeters !== undefined && <strong>{(file.distanceMeters / 1000).toFixed(2)} km</strong>}
                                        {file.elevationGain !== undefined && file.elevationGain > 0 && <span style={{ color: "var(--muted)" }}>↑ {file.elevationGain.toFixed(0)} m</span>}
                                        {file.durationSeconds !== undefined && <span style={{ color: "var(--muted)" }}>{Math.floor(file.durationSeconds / 60)} min</span>}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </article>
        </section>
    );
};
