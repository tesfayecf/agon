# Iteration 8 — Dashboard design pass

Visual proof for the dashboard refinement: fixing real layout bugs and lifting the
UI from "default card grid" to a denser, more deliberate analytics layout.

1. `01-dashboard-light.png` — Redesigned dashboard: a six-metric KPI strip with
   period-over-period delta pills, consolidated chart cards with segmented
   controls (Weekly/Monthly, Pace/Heart rate), and a sticky right rail holding
   goals, the weekly plan comparison, personal bests and the month preview.
2. `02-dashboard-dark.png` — The same layout in dark mode.
3. `03-dashboard-stacked.png` — At 900px the two-column grid now collapses to a
   single column. Previously the inline `grid-template-columns` could not be
   overridden by a media query, so both columns stayed side by side and their
   contents were squeezed at any width.
4. `04-goal-card-before.png` / `05-goal-card-after.png` — The overlap bug in the
   goal card: two `space-between` flex spans with no wrapping rendered as
   "64.00 km of 160.0096.00 km". The card was rebuilt around a progress ring with
   non-breaking figures, so values never collide or split between number and unit.

## What changed structurally

- Charts now use a fixed viewBox, so they keep a short, stable aspect ratio
  instead of growing taller as the card widens, and they gained gridlines, axis
  value labels, an area gradient (line) and a current-value callout (bar).
- `Card` supports an accent marker, eyebrow and header actions; `MetricCard`
  supports icons, hints and trend pills; both use tabular figures.
- Flex rows that could overlap (`goal` stats, `record-list__stats`) now wrap or
  use non-breaking values, and long labels truncate predictably.
