import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Tracks an element's rendered content-box width via ResizeObserver.
 *
 * Used by the hand-rolled SVG charts: instead of drawing at a fixed viewBox
 * width and letting the browser scale it (and its text) down uniformly to fit
 * a narrow card — which makes axis labels unreadable on mobile — the chart
 * measures its real container width and adapts its own layout (label count,
 * point spacing) at a constant, always-legible font size.
 */
export const useElementWidth = <T extends HTMLElement>(fallback = 640): { ref: RefObject<T | null>; width: number } => {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(fallback);

    useEffect(() => {
        const node = ref.current;
        if (node === null) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry !== undefined) setWidth(entry.contentRect.width);
        });
        observer.observe(node);
        setWidth(node.getBoundingClientRect().width);

        return () => observer.disconnect();
    }, []);

    return { ref, width };
};
