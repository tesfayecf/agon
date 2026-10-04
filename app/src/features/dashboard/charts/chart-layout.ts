/**
 * Chooses which x-axis label indices to render given the real pixel width
 * available and a minimum pixel slot per label, thinning labels out (always
 * keeping the first and last) rather than shrinking font size to fit — small
 * axis text is the main reason hand-rolled SVG charts become illegible once
 * scaled down to a phone-width card.
 */
export const pickVisibleLabelIndices = (count: number, availableWidth: number, minSlotPx: number): Set<number> => {
    if (count <= 0) return new Set();
    const maxLabels = Math.max(1, Math.floor(availableWidth / minSlotPx));
    if (maxLabels >= count) return new Set(Array.from({ length: count }, (_, i) => i));

    const step = Math.ceil(count / maxLabels);
    const indices = new Set<number>();
    let lastStepped = 0;
    for (let i = 0; i < count; i += step) {
        indices.add(i);
        lastStepped = i;
    }
    // The last label is always shown; drop the stepped one before it when it would sit too close and overlap.
    if (lastStepped !== 0 && count - 1 - lastStepped < step) indices.delete(lastStepped);
    indices.add(count - 1);
    return indices;
};
