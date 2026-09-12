# Iteration 6 — Visual proof

Screenshots from a live run of the app demonstrating the pace/heart-rate fitness
scatter plot and the new dark mode / design-token system.

1. `01-dashboard-light.png` — Dashboard in light mode, unchanged visually from
   before this iteration (tokens refactor is behavior-preserving by default).
2. `02-dashboard-dark.png` — The same dashboard in dark mode: surfaces, text,
   bar/line charts and the mini calendar all adapt via CSS custom properties,
   no per-component dark-mode code.
3. `03-settings-theme-toggle.png` — New "Appearance" section in Settings with a
   Light / Dark / System three-way toggle.
4. `04-calendar-dark.png` — Week/agenda calendar in dark mode, confirming badges
   and status colors stay legible.
5. `05-track-detail-dark.png` — Training detail page in dark mode: both the
   hand-rolled SVG time-series chart and the `<canvas>` 2D track view (which
   needed computed-style color resolution, since canvas doesn't read CSS
   variables natively) adapt correctly.
6. `06-fitness-progress-scatter.png` — New "Fitness progress" scatter plot on
   the dashboard: one point per completed training, x = pace, y = average heart
   rate, with point opacity increasing from oldest to most recent so the trend
   is readable without a separate legend or trendline.
