# Iteration 7 — Visual proof

Screenshots from a live run of the app demonstrating the new "Year" calendar view.

1. `01-year-heatmap-light.png` — Calendar with the new third "Year" toggle
   selected: a GitHub-contributions-style grid (weeks as columns, Mon–Sun as
   rows) colored by daily training distance, with month labels, a session/
   distance summary, and a "Less → More" legend.
2. `02-year-heatmap-dark.png` — The same view in dark mode, using dedicated
   `--heat-0..4` design tokens so intensity levels stay legible on a dark
   background.
3. `03-day-click-jumps-to-week.png` — Clicking a filled day cell jumps straight
   to the week/agenda view for that date, showing the completed training.
4. `04-empty-year-state.png` — Navigating to a year with no recorded training
   (via "‹ Previous year") renders an all-empty grid rather than breaking or
   showing a misleading value.
