import { useEffect, useRef, type ReactElement } from "react";
import type { ActivityRecord } from "./activity.service";

interface TrackCanvasViewProps {
    records: ActivityRecord[];
}

export const TrackCanvasView = ({ records }: TrackCanvasViewProps): ReactElement => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

        const firstValid = validPoints[0];
        if (firstValid === undefined) {
            ctx.fillStyle = "#64748b";
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
        ctx.strokeStyle = "#e2e8f0";
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
        ctx.strokeStyle = "#cbd5e1";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(originPx.px, 0);
        ctx.lineTo(originPx.px, height);
        ctx.moveTo(0, originPx.py);
        ctx.lineTo(width, originPx.py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#64748b";
        ctx.beginPath();
        ctx.arc(originPx.px, originPx.py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Track Path
        ctx.strokeStyle = "#2563eb";
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

        // Start point (green)
        ctx.fillStyle = "#16a34a";
        ctx.beginPath();
        ctx.arc(first.px, first.py, 6, 0, Math.PI * 2);
        ctx.fill();

        // End point (red)
        const lastRel = relPoints[relPoints.length - 1];
        if (lastRel !== undefined) {
            const last = toPx(lastRel);
            ctx.fillStyle = "#dc2626";
            ctx.beginPath();
            ctx.arc(last.px, last.py, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [validPoints]);

    return (
        <div style={{ margin: "1.5rem 0", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <strong>2D Relative Track View</strong>
                <small style={{ color: "#64748b" }}>
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
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                }}
            />
        </div>
    );
};

