import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";

import { fetchActivityFiles, uploadActivityFiles, updateActivityFileMetadata, type ActivityFile } from "./activity.service";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { TrackCanvasView } from "./TrackCanvasView";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDistance, formatDuration } from "../../shared/utils/format";

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

    const selectedFile = useMemo(() => files.find((file) => file.id === selectedId) ?? null, [files, selectedId]);

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
        <section aria-live="polite">
            <PageHeader
                eyebrow="Activity ingestion"
                title="Upload FIT or TCX files"
                subtitle="Select one or more activity files to inspect their parsed data."
                actions={
                    <label className="btn btn-primary file-input-btn">
                        <span>{isUploading ? "Uploading…" : "Choose files"}</span>
                        <input type="file" accept=".fit,.tcx" multiple onChange={handleUpload} disabled={isUploading} />
                    </label>
                }
            />

            {error !== null && <ErrorState message={error} />}

            <div className="card-grid" style={{ gridTemplateColumns: "minmax(240px, 1fr) minmax(0, 2.2fr)" }}>
                <Card title="Files">
                    {isLoading && <LoadingState label="Loading files…" />}
                    {!isLoading && files.length === 0 && <EmptyState title="No files uploaded yet" />}
                    {!isLoading && files.length > 0 && (
                        <ul className="record-list">
                            {files.map((file) => (
                                <li key={file.id}>
                                    <button
                                        type="button"
                                        className={`record-list__item ${selectedFile?.id === file.id ? "is-selected" : ""}`}
                                        onClick={() => setSelectedId(file.id)}
                                        style={{ width: "100%", border: "1px solid var(--border)" }}
                                    >
                                        <span className="record-list__meta">
                                            <strong>{file.filename}</strong>
                                            <small>{file.fileType} · {file.recordCount} records</small>
                                        </span>
                                        <span className={`badge ${file.status === "success" ? "badge--success" : "badge--danger"}`}>
                                            {file.status === "success" ? "Parsed" : "Error"}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title={selectedFile ? selectedFile.filename : "No file selected"}>
                    {selectedFile === null && <EmptyState title="Nothing selected" message="Upload or select a file to inspect its data." />}

                    {selectedFile !== null && selectedFile.status === "error" && (
                        <ErrorState message={selectedFile.error ?? "This file could not be processed."} />
                    )}

                    {selectedFile !== null && selectedFile.status === "success" && (
                        <>
                            <div className="metric-grid">
                                <MetricCard label="Activity date" value={selectedFile.activityDate ?? "Unavailable"} isAvailable={Boolean(selectedFile.activityDate)} />
                                <MetricCard label="Duration" value={formatDuration(selectedFile.durationSeconds)} isAvailable={(selectedFile.durationSeconds ?? 0) > 0} />
                                <MetricCard label="Distance" value={formatDistance(selectedFile.distanceMeters)} isAvailable={(selectedFile.distanceMeters ?? 0) > 0} />
                                <MetricCard label="Records" value={String(selectedFile.recordCount)} />
                            </div>

                            {selectedFile.records && selectedFile.records.length > 0 && (
                                <>
                                    <TimeSeriesChart records={selectedFile.records} />
                                    <TrackCanvasView records={selectedFile.records} />
                                </>
                            )}

                            {(!selectedFile.records || selectedFile.records.length === 0) && (
                                <p style={{ marginTop: "1rem", color: "var(--muted)" }}>This file parsed but did not contain activity records.</p>
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
                </Card>
            </div>
        </section>
    );
};
