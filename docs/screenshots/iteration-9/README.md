# Iteration 9 — Accessibility, responsiveness, and a real insight feature

## New: Training Load (acute:chronic workload ratio)

A prominent new dashboard card computing a distance-based ACWR: the last
7 days' volume vs. the last 28 days' weekly average, banded into
Low / Optimal / Caution / High (thresholds from the commonly-cited
acute:chronic workload literature — <0.8, 0.8–1.3, 1.3–1.5, >1.5), shown as a
gauge with a plain-language headline. The chronic window normalizes by actual
days of history (not always ÷4 weeks) so new accounts aren't penalized, and
the UI is explicit about the method's limits (distance-only proxy, no
intensity/injury/sleep data). Covered by 6 Go unit tests spanning every band
plus the history-normalization behavior.

A secondary "Efficiency" chip on the Fitness Progress card compares aerobic
efficiency (speed per heartbeat) between the earlier and more recent half of
recorded trainings, only surfacing when the change exceeds a 3% noise floor.
Covered by dashboard.utils.test.ts.

01/02/03/04 show this card in light, dark, tablet, and mobile.

## Accessibility (axe-core: 0 violations, was ~200+ before)

- `--muted` and the semantic success/warning/danger tokens were failing
  WCAG AA contrast (as low as 1.69:1 in one case) — root-caused to two
  patterns: a gray that was simply too light, and calendar cells faded via
  CSS `opacity`, which blends text toward the background it sits on and
  necessarily loses contrast against that same background. Fixed by
  darkening the tokens and replacing opacity-fades with explicit,
  still-compliant colors.
- Dark-mode buttons had white text on a light-teal accent fill (2.75:1) — a
  new `--accent-ink` token supplies a dark foreground instead where needed.
- The year heatmap had 365+ individually tabbable `<button>` cells — a real
  keyboard trap. Rewritten with roving tabindex (one Tab stop, then
  Arrow/Home/End to navigate, Enter to activate), matching the standard
  composite-widget pattern.
- Added a skip-to-content link, app-wide `:focus-visible` styling, a
  `prefers-reduced-motion` override, and fixed sub-24px touch targets
  (`.card__link` was 20px tall).

## Responsive charts (05, 06, 07)

The hand-rolled SVG charts previously drew at a fixed 760px viewBox and let
the browser scale the whole thing down to fit a phone-width card — at ~0.4x
scale, 10px axis labels rendered as ~4px, illegible. They now measure their
real container width via `ResizeObserver` and draw 1:1 in real pixels, always
at a legible font size, thinning out x-axis labels (never shrinking them) when
there isn't room for all of them.

05 also fixes a real overflow: the calendar's Week/Month/Year toggle plus
navigation controls didn't wrap, clipping off-screen at phone width.
