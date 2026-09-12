import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";

import { fetchActivityFiles, uploadActivityFiles, type ActivityFile } from "./activity.service";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { TrackCanvasView } from "./TrackCanvasView";

const emptyList: ActivityFile[] = [];

export const ActivityPage = (): ReactElement => {
    const [files, setFiles] = useState<ActivityFile[]>(emptyList);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetchActivityFiles()
            .then((res) => {
                if (!mounted) return;
                const loaded = res.files ?? [];
                setFiles(loaded);
                const firstLoaded = loaded[0];
                if (firstLoaded !== undefined) {
                    setSelectedId(firstLoaded.id);
                }
            })
            .catch(() => {
                // Ignore initial fetch errors
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const selectedFile = useMemo(() => files.find((file) => file.id === selectedId) ?? files[0] ?? null, [files, selectedId]);

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const nextFiles = event.target.files;
        if (nextFiles === null || nextFiles.length === 0) {
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const response = await uploadActivityFiles(nextFiles);
            const nextItems = response.files.filter((file) => file.filename.length > 0);
            const uploaded = nextItems.length > 0 ? nextItems : [];
            setFiles(uploaded);
            setSelectedId(uploaded[0]?.id ?? null);

            const failed = uploaded.filter((file) => file.status === "error");
            if (failed.length > 0 && uploaded.length === 0) {
                setError("No valid FIT or TCX files were accepted.");
            } else if (failed.length > 0) {
                setError(failed.map((file) => `${file.filename}: ${file.error ?? "could not be processed"}`).join("; "));
            }
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "The server could not process the upload.";
            setError(message);
            setFiles([]);
            setSelectedId(null);
        } finally {
            setIsUploading(false);
            event.target.value = "";
        }
    };

    return (
        <section className="upload-grid" aria-live="polite">
            <article className="upload-panel">
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Activity ingestion</p>
                        <h2>Upload FIT or TCX files</h2>
                    </div>
                    <span className={`status-pill ${isUploading ? "status-pill--pending" : "status-pill--ready"}`}>
                        {isUploading ? "Processing" : "Ready"}
                    </span>
                </div>

                <p className="panel__copy">
                    Select one or more activity files to inspect their parsed data on the server.
                </p>

                <div className="upload-actions">
                    <label className="file-input">
                        <input type="file" accept=".fit,.tcx" multiple onChange={handleUpload} />
                        <span>{isUploading ? "Uploading…" : "Choose files"}</span>
                    </label>
                </div>

                {error !== null && <div className="error-banner">{error}</div>}
            </article>

            <article className="upload-list">
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Files</p>
                        <h2>Uploaded activities</h2>
                    </div>
                </div>

                {isLoading && <p className="panel__copy">Loading files from database…</p>}

                {!isLoading && files.length === 0 && <p className="panel__copy">No files uploaded yet.</p>}

                {!isLoading && files.length > 0 && (
                    <ul className="file-list">
                        {files.map((file) => (
                            <li key={file.id}>
                                <button
                                    type="button"
                                    className={`file-list__item ${selectedFile?.id === file.id ? "is-selected" : ""}`}
                                    onClick={() => setSelectedId(file.id)}
                                >
                                    <span className="file-meta">
                                        <strong>{file.filename}</strong>
                                        <small>
                                            {file.fileType} · {file.recordCount} records
                                        </small>
                                    </span>
                                    <span className={`status-pill ${file.status === "success" ? "status-pill--ready" : "status-pill--offline"}`}>
                                        {file.status === "success" ? "Parsed" : "Error"}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </article>

            <article className="upload-detail">
                <div className="panel__header">
                    <div>
                        <p className="eyebrow">Detail & Visualization</p>
                        <h2>{selectedFile ? selectedFile.filename : "No activity selected"}</h2>
                    </div>
                </div>

                {selectedFile === null && <p className="panel__copy">Upload or select a FIT or TCX file to inspect its data and track visualizations.</p>}

                {selectedFile !== null && selectedFile.status === "error" && (
                    <p className="error-banner">{selectedFile.error ?? "This file could not be processed."}</p>
                )}

                {selectedFile !== null && selectedFile.status === "success" && (
                    <>
                        <div className="metric-grid">
                            <article>
                                <span>Activity date</span>
                                <strong>{selectedFile.activityDate || "Unavailable"}</strong>
                            </article>
                            <article>
                                <span>Duration</span>
                                <strong>{selectedFile.durationSeconds ? `${selectedFile.durationSeconds.toFixed(1)} s` : "Unavailable"}</strong>
                            </article>
                            <article>
                                <span>Distance</span>
                                <strong>{selectedFile.distanceMeters ? `${selectedFile.distanceMeters.toFixed(1)} m` : "Unavailable"}</strong>
                            </article>
                            <article>
                                <span>Records</span>
                                <strong>{selectedFile.recordCount}</strong>
                            </article>
                        </div>

                        {selectedFile.records && selectedFile.records.length > 0 && (
                            <>
                                <TimeSeriesChart records={selectedFile.records} />
                                <TrackCanvasView records={selectedFile.records} />
                            </>
                        )}

                        {(!selectedFile.records || selectedFile.records.length === 0) && (
                            <p className="panel__copy" style={{ marginTop: "1rem" }}>This file parsed but did not contain activity records.</p>
                        )}

                        {selectedFile.records && selectedFile.records.length > 0 && (
                            <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                                <h3>Sample Records</h3>
                                <table className="record-table">
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Latitude</th>
                                            <th>Longitude</th>
                                            <th>Distance</th>
                                            <th>Speed</th>
                                            <th>Heart rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedFile.records.slice(0, 12).map((record, index) => (
                                            <tr key={`${selectedFile.id}-${index}`}>
                                                <td>{record.timestamp ?? "—"}</td>
                                                <td>{record.latitude !== undefined ? record.latitude.toFixed(5) : "—"}</td>
                                                <td>{record.longitude !== undefined ? record.longitude.toFixed(5) : "—"}</td>
                                                <td>{record.distance !== undefined ? `${record.distance.toFixed(1)} m` : "—"}</td>
                                                <td>{record.speed !== undefined ? `${record.speed.toFixed(2)} m/s` : "—"}</td>
                                                <td>{record.heartRate !== undefined ? `${record.heartRate.toFixed(0)} bpm` : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </article>
        </section>
    );
};
