import { useEffect, useRef, type ReactElement } from "react";
import type { ActivityRecord } from "./activity.service";
import { useTheme } from "../../shared/theme/ThemeContext";

interface TrackCanvasViewProps {
    records: ActivityRecord[];
}

/** Canvas 2D drawing doesn't go through the CSS cascade, so var(--x) references must be
 * resolved to their computed value before being handed to ctx.fillStyle/strokeStyle. */
const resolveCssVar = (name: string): string => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value === "" ? "#64748b" : value;
};

export const TrackCanvasView = ({ records }: TrackCanvasViewProps): ReactElement => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { theme } = useTheme();

    const validPoints = records.filter(
        (r): r is ActivityRecord & { latitude: number; longitude: number } =>
            typeof r.latitude === "number" && !isNaN(r.latitude) && typeof r.longitude === "number" && !isNaN(r.longitude),
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

        const width = canvas.width;
        const height = canvas.height;
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
        const pad = 40;
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
    }, [validPoints, theme]);

    return (
        <div style={{ margin: "1.5rem 0", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <strong>2D Relative Track View</strong>
                <small style={{ color: "var(--muted)" }}>
                    Origin (0,0) @ {validPoints[0] !== undefined ? `${validPoints[0].latitude.toFixed(4)}, ${validPoints[0].longitude.toFixed(4)}` : "N/A"}
                </small>
            </div>
            <canvas
                ref={canvasRef}
                width={650}
                height={350}
                style={{
                    width: "100%",
                    maxWidth: "650px",
                    height: "auto",
                    backgroundColor: "var(--surface-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                }}
            />
        </div>
    );
};

