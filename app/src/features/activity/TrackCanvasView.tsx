import { useEffect, useMemo, useRef, type ReactElement } from "react";
import type { ActivityRecord, IntervalKind } from "./activity.service";
import { useElementWidth } from "../../shared/hooks/useElementWidth";
import { elapsedSeconds, type ResolvedInterval } from "./intervals";
import { useTheme } from "../../shared/theme/ThemeContext";

interface TrackCanvasViewProps {
    records: ActivityRecord[];
    /** Resolved intervals, drawn over the route. */
    intervals?: ResolvedInterval[];
    /** Index of the interval to emphasize. */
    selected?: number | null;
}

const KIND_COLOR: Record<IntervalKind, string> = {
    work: "--chart-4",
    recovery: "--chart-1",
    warmup: "--muted",
    cooldown: "--muted",
};

const CANVAS_H = 170; // matches the time series chart, so switching views does not move the page

/** Canvas 2D drawing doesn't go through the CSS cascade, so var(--x) references must be
 * resolved to their computed value before being handed to ctx.fillStyle/strokeStyle. */
const resolveCssVar = (name: string): string => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value === "" ? "#64748b" : value;
};

export const TrackCanvasView = ({ records, intervals = [], selected = null }: TrackCanvasViewProps): ReactElement => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { ref: wrapRef, width: boxWidth } = useElementWidth<HTMLDivElement>(650);
    const { theme } = useTheme();

    // GPS fixes with their elapsed time, which is how intervals are addressed.
    const validPoints = useMemo(
        () =>
            elapsedSeconds(records).flatMap(({ t, rec }) =>
                typeof rec.latitude === "number" && !isNaN(rec.latitude) && typeof rec.longitude === "number" && !isNaN(rec.longitude)
                    ? [{ latitude: rec.latitude, longitude: rec.longitude, t }]
                    : [],
            ),
        [records],
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) {
            return;
        }

        const ctx = canvas.getContext("2d");
        if (ctx === null) {
            return;
        }

        // Draw at the real pixel size (and device pixel ratio) so the map stays crisp at a fixed height.
        const width = Math.max(200, Math.floor(boxWidth) - 2); // minus the canvas border
        const height = CANVAS_H;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const mutedColor = resolveCssVar("--muted");
        const gridColor = resolveCssVar("--chart-grid");
        const borderStrongColor = resolveCssVar("--border-strong");
        const pathColor = resolveCssVar("--chart-2");
        const startColor = resolveCssVar("--success");
        const endColor = resolveCssVar("--danger");

        const firstValid = validPoints[0];
        if (firstValid === undefined) {
            ctx.fillStyle = mutedColor;
            ctx.font = "14px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("No GPS coordinate data available for track view.", width / 2, height / 2);
            return;
        }

        const originLat = firstValid.latitude;
        const originLon = firstValid.longitude;
        const radLat = (originLat * Math.PI) / 180;
        const metersPerDegLon = 111320 * Math.cos(radLat);
        const metersPerDegLat = 110540;

        const relPoints = validPoints.map((p) => ({
            x: (p.longitude - originLon) * metersPerDegLon,
            y: (p.latitude - originLat) * metersPerDegLat,
            t: p.t,
        }));

        const firstRel = relPoints[0];
        if (firstRel === undefined) {
            return;
        }

        let minX = firstRel.x;
        let maxX = firstRel.x;
        let minY = firstRel.y;
        let maxY = firstRel.y;

        for (const pt of relPoints) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        }

        const trackW = Math.max(maxX - minX, 10);
        const trackH = Math.max(maxY - minY, 10);
        const pad = 22;
        const availW = width - pad * 2;
        const availH = height - pad * 2;
        const scale = Math.min(availW / trackW, availH / trackH);

        const offX = pad + (availW - trackW * scale) / 2;
        const offY = pad + (availH - trackH * scale) / 2;

        const toPx = (pt: { x: number; y: number }): { px: number; py: number } => ({
            px: offX + (pt.x - minX) * scale,
            py: height - (offY + (pt.y - minY) * scale),
        });

        // Grid lines
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Relative Origin (0,0) indicator
        const originPx = toPx({ x: 0, y: 0 });
        ctx.strokeStyle = borderStrongColor;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(originPx.px, 0);
        ctx.lineTo(originPx.px, height);
        ctx.moveTo(0, originPx.py);
        ctx.lineTo(width, originPx.py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = mutedColor;
        ctx.beginPath();
        ctx.arc(originPx.px, originPx.py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Track Path
        ctx.strokeStyle = pathColor;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.beginPath();

        const first = toPx(firstRel);
        ctx.moveTo(first.px, first.py);

        for (let i = 1; i < relPoints.length; i++) {
            const pt = relPoints[i];
            if (pt !== undefined) {
                const pxPt = toPx(pt);
                ctx.lineTo(pxPt.px, pxPt.py);
            }
        }
        ctx.stroke();

        // Intervals over the route: the selected one gets a halo so it stands out.
        const drawInterval = (iv: ResolvedInterval, isSelected: boolean): void => {
            const segment = relPoints.filter((pt) => pt.t >= iv.startSeconds && pt.t <= iv.endSeconds);
            if (segment.length < 2) return;
            const trace = (): void => {
                ctx.beginPath();
                segment.forEach((pt, i) => {
                    const px = toPx(pt);
                    if (i === 0) ctx.moveTo(px.px, px.py);
                    else ctx.lineTo(px.px, px.py);
                });
                ctx.stroke();
            };
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            if (isSelected) {
                ctx.strokeStyle = resolveCssVar("--ink");
                ctx.globalAlpha = 0.35;
                ctx.lineWidth = 12;
                trace();
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = resolveCssVar(KIND_COLOR[iv.kind]);
            ctx.lineWidth = iv.kind === "work" ? 6 : 4.5;
            trace();
            ctx.lineCap = "butt";
        };
        intervals.forEach((iv, i) => {
            if (iv.durationSeconds > 0 && i !== selected) drawInterval(iv, false);
        });
        const selectedInterval = selected === null ? undefined : intervals[selected];
        if (selectedInterval !== undefined && selectedInterval.durationSeconds > 0) drawInterval(selectedInterval, true);

        // Start point (success color)
        ctx.fillStyle = startColor;
        ctx.beginPath();
        ctx.arc(first.px, first.py, 6, 0, Math.PI * 2);
        ctx.fill();

        // End point (danger color)
        const lastRel = relPoints[relPoints.length - 1];
        if (lastRel !== undefined) {
            const last = toPx(lastRel);
            ctx.fillStyle = endColor;
            ctx.beginPath();
            ctx.arc(last.px, last.py, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [validPoints, intervals, selected, theme, boxWidth]);

    const origin = validPoints[0];

    return (
        <div className="track-view" ref={wrapRef}>
            <canvas
                ref={canvasRef}
                className="track-view__canvas"
                role="img"
                aria-label="Route of the training on a relative 2D map"
                title={origin !== undefined ? `Origin (0,0) @ ${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)}` : "No GPS data"}
            />
        </div>
    );
};
