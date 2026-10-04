import { useEffect, useMemo, useState, type MouseEvent, type ReactElement } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    deleteActivityFile,
    fetchActivityFileById,
    fetchActivityFiles,
    updateActivityFileMetadata,
    updateActivityWorkout,
    type ActivityFile,
    type WorkoutInterval,
    type WorkoutType,
} from "./activity.service";
import { buildSeries, resolveInterval, toInput, WORKOUT_TYPE_LABELS } from "./intervals";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { TrackCanvasView } from "./TrackCanvasView";
import { WorkoutPanel } from "./WorkoutPanel";
import { Card } from "../../shared/components/Card";
import { MetricCard } from "../../shared/components/MetricCard";
import { LoadingState, ErrorState } from "../../shared/components/StateViews";
import { formatDate, formatDateTime, formatDistance, formatDuration, formatElevation, formatHeartRate, formatPace } from "../../shared/utils/format";

const trainingLabel = (f: ActivityFile): string => `${f.name || f.filename} · ${formatDate(f.activityDate)}`;

export const TrackDetailPage = (): ReactElement => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [file, setFile] = useState<ActivityFile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [workoutType, setWorkoutType] = useState<WorkoutType>("");
    const [intervals, setIntervals] = useState<WorkoutInterval[]>([]);
    const [selectedInterval, setSelectedInterval] = useState<number | null>(null);
    const [isSavingWorkout, setIsSavingWorkout] = useState(false);
    const [workoutError, setWorkoutError] = useState<string | null>(null);
    const [allTrainings, setAllTrainings] = useState<ActivityFile[]>([]);

    const loadWorkout = (f: ActivityFile): void => {
        setWorkoutType(f.workoutType ?? "");
        setIntervals((f.intervals ?? []).map(toInput));
        setSelectedInterval(null);
        setWorkoutError(null);
    };

    // Every training, newest first, to navigate between neighbours.
    useEffect(() => {
        let cancelled = false;
        fetchActivityFiles()
            .then((res) => {
                if (!cancelled) setAllTrainings(res.files);
            })
            .catch(() => undefined); // navigation is a convenience; the page works without it
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setError(null);
        setIsEditing(false);
        fetchActivityFileById(id)
            .then((res) => {
                if (cancelled) return;
                setFile(res);
                setName(res.name || res.filename);
                setDescription(res.description || "");
                setTags(res.tags || "");
                loadWorkout(res);
                document.getElementById("main-content")?.scrollTo({ top: 0 });
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Could not load training.");
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id]);

    const sorted = useMemo(() => {
        const time = (f: ActivityFile): number => {
            const t = Date.parse(f.activityDate ?? f.createdAt ?? "");
            return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
        };
        return allTrainings.filter((f) => f.status === "success").sort((a, b) => time(b) - time(a));
    }, [allTrainings]);
    const position = sorted.findIndex((f) => f.id === id);
    const newer = position > 0 ? sorted[position - 1] : undefined;
    const older = position >= 0 ? sorted[position + 1] : undefined;

    const series = useMemo(() => (file?.records ? buildSeries(file.records) : null), [file?.records]);
    const resolved = useMemo(() => intervals.map((iv) => resolveInterval(series, iv)), [series, intervals]);
    const savedWorkout = JSON.stringify([file?.workoutType ?? "", (file?.intervals ?? []).map(toInput)]);
    const draftWorkout = JSON.stringify([workoutType, workoutType === "intervals" ? intervals.map(toInput) : []]);
    const isWorkoutDirty = savedWorkout !== draftWorkout && (workoutType !== "" || (file?.workoutType ?? "") !== "" || intervals.length > 0);

    /** Asks before leaving the page with an unsaved workout. */
    const guardLeave = (e: MouseEvent): void => {
        if (isWorkoutDirty && !window.confirm("You have unsaved workout changes. Leave without saving?")) e.preventDefault();
    };

    const handleSave = async () => {
        if (!id) return;
        try {
            const updated = await updateActivityFileMetadata(id, { name, description, tags });
            setFile((prev) => (prev ? { ...prev, ...updated, records: prev.records, intervals: prev.intervals, workoutType: prev.workoutType } : updated));
            setIsEditing(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update metadata");
        }
    };

    const handleSaveWorkout = async () => {
        if (!id) return;
        setIsSavingWorkout(true);
        setWorkoutError(null);
        try {
            const updated = await updateActivityWorkout(id, { workoutType, intervals: workoutType === "intervals" ? intervals.map(toInput) : [] });
            // The save response has no track records; keep the ones already loaded.
            setFile((prev) => (prev ? { ...prev, workoutType: updated.workoutType, intervals: updated.intervals } : prev));
            loadWorkout(updated);
        } catch (err) {
            setWorkoutError(err instanceof Error ? err.message : "Failed to save workout");
        } finally {
            setIsSavingWorkout(false);
        }
    };

    const handleDelete = async () => {
        if (!id || !file) return;
        const label = file.name || file.filename;
        if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
        setIsDeleting(true);
        try {
            await deleteActivityFile(id);
            navigate("/tracks", { replace: true });
        } catch (err) {
            setIsDeleting(false);
            alert(err instanceof Error ? err.message : "Failed to delete training");
        }
    };

    if (isLoading && file === null) {
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

    const isSwitching = file.id !== id;
    const hasTrack = file.records?.some((r) => typeof r.latitude === "number" && typeof r.longitude === "number") ?? false;
    const avgPace = (file.distanceMeters ?? 0) > 0 && (file.durationSeconds ?? 0) > 0 ? (file.durationSeconds ?? 0) / ((file.distanceMeters ?? 0) / 1000) : undefined;
    const shownIntervals = workoutType === "intervals" ? resolved : [];

    return (
        <section className={`track-page${isSwitching ? " is-switching" : ""}`} aria-live="polite" aria-busy={isSwitching}>
            <header className="track-header">
                <div className="track-header__main">
                    <Link to="/tracks" className="track-header__back" onClick={guardLeave} aria-label="Back to trainings" title="Back to trainings">
                        ←
                    </Link>
                    <h1 className="page-header__title track-header__title">{isEditing ? "Edit training" : file.name || file.filename}</h1>
                    {!isEditing && (
                        <p className="track-header__meta">
                            <span>{formatDateTime(file.activityDate)}</span>
                            {file.workoutType ? <span className="badge badge--neutral">{WORKOUT_TYPE_LABELS[file.workoutType]}</span> : null}
                            {file.tags ? <span className="track-header__tags">{file.tags}</span> : null}
                        </p>
                    )}
                </div>

                <div className="track-header__actions">
                    <nav className="track-nav" aria-label="Navigate between trainings">
                        {older ? (
                            <Link to={`/tracks/${encodeURIComponent(older.id)}`} className="btn btn-sm track-nav__btn" title={`Older: ${trainingLabel(older)}`} onClick={guardLeave}>
                                <span aria-hidden="true">←</span> Older
                            </Link>
                        ) : (
                            <span className="btn btn-sm track-nav__btn is-disabled" aria-disabled="true">
                                <span aria-hidden="true">←</span> Older
                            </span>
                        )}
                        {position >= 0 && (
                            <span className="track-nav__pos" aria-label={`Training ${position + 1} of ${sorted.length}, newest first`}>
                                {position + 1} / {sorted.length}
                            </span>
                        )}
                        {newer ? (
                            <Link to={`/tracks/${encodeURIComponent(newer.id)}`} className="btn btn-sm track-nav__btn" title={`Newer: ${trainingLabel(newer)}`} onClick={guardLeave}>
                                Newer <span aria-hidden="true">→</span>
                            </Link>
                        ) : (
                            <span className="btn btn-sm track-nav__btn is-disabled" aria-disabled="true">
                                Newer <span aria-hidden="true">→</span>
                            </span>
                        )}
                    </nav>

                    <div className="track-header__buttons">
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
                            <>
                                <button type="button" className="btn btn-sm" onClick={() => setIsEditing(true)}>
                                    Edit
                                </button>
                                <button type="button" className="btn btn-sm btn-danger" onClick={handleDelete} disabled={isDeleting}>
                                    {isDeleting ? "Deleting…" : "Delete"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {file.status === "error" && <ErrorState message={file.error ?? "This file could not be processed."} />}

            {isEditing && (
                <Card>
                    <div className="track-edit">
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
                </Card>
            )}

            {!isEditing && file.description && <p className="track-description">{file.description}</p>}

            {/* 1 · Metrics */}
            <div className="metric-grid track-metrics">
                <MetricCard label="Distance" value={formatDistance(file.distanceMeters)} isAvailable={(file.distanceMeters ?? 0) > 0} />
                <MetricCard label="Duration" value={formatDuration(file.durationSeconds)} isAvailable={(file.durationSeconds ?? 0) > 0} />
                <MetricCard label="Avg pace" value={formatPace(avgPace)} isAvailable={avgPace !== undefined} />
                <MetricCard label="Avg heart rate" value={formatHeartRate(file.avgHeartRate)} isAvailable={(file.avgHeartRate ?? 0) > 0} />
                <MetricCard label="Elevation" value={formatElevation(file.elevationGain)} isAvailable={(file.elevationGain ?? 0) > 0} />
            </div>

            {/* 2 · Track and charts (the track is the first, default view) and the interval editor */}
            <Card>
                {file.records && file.records.length > 0 ? (
                    <TimeSeriesChart
                        records={file.records}
                        series={series}
                        intervals={shownIntervals}
                        trackView={hasTrack ? <TrackCanvasView records={file.records} intervals={shownIntervals} selected={selectedInterval} /> : undefined}
                    />
                ) : (
                    file.status === "success" && <p className="track-section__empty">This file parsed but did not contain track records.</p>
                )}

                {file.status === "success" && (
                    <WorkoutPanel
                        series={series}
                        workoutType={workoutType}
                        intervals={intervals}
                        resolved={resolved}
                        selected={selectedInterval}
                        onSelect={setSelectedInterval}
                        isDirty={isWorkoutDirty}
                        isSaving={isSavingWorkout}
                        error={workoutError}
                        onTypeChange={setWorkoutType}
                        onIntervalsChange={setIntervals}
                        onSave={() => void handleSaveWorkout()}
                        onDiscard={() => loadWorkout(file)}
                    />
                )}
            </Card>
        </section>
    );
};
