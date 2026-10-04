import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { deleteActivityFile, fetchActivityFiles, uploadActivityFiles, type ActivityFile, type ActivityFilterParams } from "./activity.service";
import { PageHeader } from "../../shared/components/PageHeader";
import { Card } from "../../shared/components/Card";
import { LoadingState, EmptyState, ErrorState } from "../../shared/components/StateViews";
import { formatDateTime, formatDistance, formatDuration, formatElevation } from "../../shared/utils/format";

interface FilterState {
    q: string;
    tag: string;
    dateFrom: string;
    dateTo: string;
    minDistanceKm: string;
    maxDistanceKm: string;
}

const EMPTY_FILTERS: FilterState = { q: "", tag: "", dateFrom: "", dateTo: "", minDistanceKm: "", maxDistanceKm: "" };

const toParams = (filters: FilterState): ActivityFilterParams => {
    const params: ActivityFilterParams = {};
    if (filters.q.trim() !== "") params.q = filters.q.trim();
    if (filters.tag.trim() !== "") params.tag = filters.tag.trim();
    if (filters.dateFrom !== "") params.dateFrom = filters.dateFrom;
    if (filters.dateTo !== "") params.dateTo = filters.dateTo;
    if (filters.minDistanceKm.trim() !== "") params.minDistance = Number(filters.minDistanceKm) * 1000;
    if (filters.maxDistanceKm.trim() !== "") params.maxDistance = Number(filters.maxDistanceKm) * 1000;
    return params;
};

interface ActiveChip {
    key: keyof FilterState;
    label: string;
}

export const TracksPage = (): ReactElement => {
    const [files, setFiles] = useState<ActivityFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadFiles = (activeFilters: FilterState) => {
        setIsLoading(true);
        fetchActivityFiles(toParams(activeFilters))
            .then((res) => setFiles(res.files || []))
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load trainings."))
            .finally(() => setIsLoading(false));
    };

    // Debounce so search/filter changes update results without extra navigation.
    useEffect(() => {
        const handle = setTimeout(() => loadFiles(filters), 250);
        return () => clearTimeout(handle);
    }, [filters]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextFiles = e.target.files;
        if (!nextFiles || nextFiles.length === 0) return;
        setIsUploading(true);
        setError(null);
        try {
            await uploadActivityFiles(nextFiles);
            loadFiles(filters);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    const handleDelete = async (file: ActivityFile) => {
        const label = file.name || file.filename;
        if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
        setDeletingId(file.id);
        setError(null);
        try {
            await deleteActivityFile(file.id);
            setFiles((prev) => prev.filter((item) => item.id !== file.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete training.");
        } finally {
            setDeletingId(null);
        }
    };

    const setFilter = (key: keyof FilterState, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
    const clearFilter = (key: keyof FilterState) => setFilters((prev) => ({ ...prev, [key]: "" }));
    const clearAll = () => setFilters(EMPTY_FILTERS);

    const activeChips = useMemo<ActiveChip[]>(() => {
        const chips: ActiveChip[] = [];
        if (filters.q.trim() !== "") chips.push({ key: "q", label: `Search: "${filters.q.trim()}"` });
        if (filters.tag.trim() !== "") chips.push({ key: "tag", label: `Tag: ${filters.tag.trim()}` });
        if (filters.dateFrom !== "") chips.push({ key: "dateFrom", label: `From: ${filters.dateFrom}` });
        if (filters.dateTo !== "") chips.push({ key: "dateTo", label: `To: ${filters.dateTo}` });
        if (filters.minDistanceKm.trim() !== "") chips.push({ key: "minDistanceKm", label: `Min: ${filters.minDistanceKm} km` });
        if (filters.maxDistanceKm.trim() !== "") chips.push({ key: "maxDistanceKm", label: `Max: ${filters.maxDistanceKm} km` });
        return chips;
    }, [filters]);

    const hasActiveFilters = activeChips.length > 0;

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
                <div className="filter-bar">
                    <input
                        type="search"
                        className="filter-bar__search"
                        placeholder="Search by name or tag…"
                        value={filters.q}
                        onChange={(e) => setFilter("q", e.target.value)}
                        aria-label="Search trainings"
                    />
                    <div className="filter-bar__field">
                        <label htmlFor="filter-tag">Tag</label>
                        <input id="filter-tag" type="text" value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)} placeholder="e.g. intervals" />
                    </div>
                    <div className="filter-bar__field">
                        <label htmlFor="filter-date-from">From</label>
                        <input id="filter-date-from" type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
                    </div>
                    <div className="filter-bar__field">
                        <label htmlFor="filter-date-to">To</label>
                        <input id="filter-date-to" type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
                    </div>
                    <div className="filter-bar__field">
                        <label htmlFor="filter-min-distance">Min km</label>
                        <input id="filter-min-distance" type="number" min="0" step="0.1" value={filters.minDistanceKm} onChange={(e) => setFilter("minDistanceKm", e.target.value)} />
                    </div>
                    <div className="filter-bar__field">
                        <label htmlFor="filter-max-distance">Max km</label>
                        <input id="filter-max-distance" type="number" min="0" step="0.1" value={filters.maxDistanceKm} onChange={(e) => setFilter("maxDistanceKm", e.target.value)} />
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="filter-chips">
                        {activeChips.map((chip) => (
                            <button type="button" key={chip.key} className="filter-chip" onClick={() => clearFilter(chip.key)}>
                                {chip.label} <span aria-hidden="true">×</span>
                            </button>
                        ))}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                            Clear all
                        </button>
                    </div>
                )}

                <p className="filter-result-count">
                    {isLoading ? "Searching…" : `${files.length} training${files.length === 1 ? "" : "s"} found`}
                </p>

                {isLoading && <LoadingState label="Loading trainings…" />}
                {!isLoading && files.length === 0 && hasActiveFilters && (
                    <EmptyState
                        title="No trainings match these filters"
                        message="Try widening the date range, distance range, or clearing a filter."
                        action={
                            <button type="button" className="btn btn-sm" onClick={clearAll}>
                                Clear all filters
                            </button>
                        }
                    />
                )}
                {!isLoading && files.length === 0 && !hasActiveFilters && (
                    <EmptyState
                        title="No trainings uploaded yet"
                        message='Click "+ Upload Track" above to add your first FIT or TCX file.'
                    />
                )}
                {!isLoading && files.length > 0 && (
                    <ul className="record-list">
                        {files.map((file) => (
                            <li key={file.id} className="record-list__row">
                                <Link to={`/tracks/${file.id}`} className="record-list__item">
                                    <div className="record-list__meta">
                                        <strong>{file.name || file.filename}</strong>
                                        <small>
                                            {file.activityDate ? formatDateTime(file.activityDate) : file.filename}
                                            {file.workoutType ? ` · ${file.workoutType === "intervals" ? `Intervals${file.intervals?.some((iv) => iv.kind === "work") ? ` (${file.intervals.filter((iv) => iv.kind === "work").length}×)` : ""}` : file.workoutType}` : ""}
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
                                <button
                                    type="button"
                                    className="icon-btn icon-btn--danger record-list__delete"
                                    title="Delete training"
                                    aria-label={`Delete ${file.name || file.filename}`}
                                    disabled={deletingId === file.id}
                                    onClick={() => handleDelete(file)}
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </section>
    );
};
