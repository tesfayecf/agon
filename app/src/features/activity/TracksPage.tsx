import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { fetchActivityFiles, uploadActivityFiles, type ActivityFile } from "./activity.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDistance, formatDuration, formatElevation } from "../../shared/utils/format";

export const TracksPage = (): ReactElement => {
    const [files, setFiles] = useState<ActivityFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = () => {
        setIsLoading(true);
        fetchActivityFiles()
            .then((res) => setFiles(res.files || []))
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load trainings."))
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
        <section aria-live="polite">
            <PageHeader
                eyebrow="Library"
                title="Trainings"
                subtitle="All uploaded training sessions, most recent first."
                actions={
                    <label className="btn btn-primary file-input-btn">
                        <span>{isUploading ? "Uploading…" : "+ Upload Track"}</span>
                        <input type="file" multiple accept=".fit,.tcx" onChange={handleUpload} disabled={isUploading} />
                    </label>
                }
            />

            {error !== null && <ErrorState message={error} />}

            <Card>
                {isLoading && <LoadingState label="Loading trainings…" />}
                {!isLoading && files.length === 0 && (
                    <EmptyState
                        title="No trainings uploaded yet"
                        message='Click "+ Upload Track" above to add your first FIT or TCX file.'
                    />
                )}
                {!isLoading && files.length > 0 && (
                    <ul className="record-list">
                        {files.map((file) => (
                            <li key={file.id}>
                                <Link to={`/tracks/${file.id}`} className="record-list__item">
                                    <div className="record-list__meta">
                                        <strong>{file.name || file.filename}</strong>
                                        <small>
                                            {file.activityDate ? new Date(file.activityDate).toLocaleString() : file.filename}
                                            {file.tags ? ` · ${file.tags}` : ""}
                                        </small>
                                    </div>
                                    <div className="record-list__stats">
                                        {file.distanceMeters !== undefined && file.distanceMeters > 0 && (
                                            <strong>{formatDistance(file.distanceMeters)}</strong>
                                        )}
                                        {file.elevationGain !== undefined && file.elevationGain > 0 && (
                                            <span>↑ {formatElevation(file.elevationGain)}</span>
                                        )}
                                        {file.durationSeconds !== undefined && file.durationSeconds > 0 && (
                                            <span>{formatDuration(file.durationSeconds)}</span>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </section>
    );
};
