# Iteration 5 — Visual proof

Screenshots captured from a live run of the app (Go backend + Vite dev server) after
seeding ~6 weeks of varied completed trainings (easy/intervals/tempo/long/race, with
heart rate), a weekly and monthly distance goal, a reusable weekly schedule template,
and one explicit planned session overriding the current week.

1. `01-dashboard-overview.png` — Redesigned Dashboard: current week/month distance,
   completed sessions, total duration, weekly mileage trend, active goals with
   progress bars, and a "planned vs. completed" comparison for the current week.
2. `02-dashboard-trends-and-bests.png` — Monthly mileage trend, weekly average pace
   trend, weekly average heart-rate trend, and personal bests (5k/10k/half marathon)
   identified from recorded training data.
3. `03-calendar-week-agenda.png` — The calendar now opens in a week/agenda view by
   default (with a Month toggle preserved). Today is highlighted, completed and
   planned sessions are visually and textually distinguished (✓ Completed / ○ Planned
   / ✓ Planned · done / ◌ Template default), and a planned session can be added or
   removed per day without navigating away.
4. `04-trainings-list.png` — Trainings list with the new search/filter bar (free-text
   search, tag, date range, distance range) and a live result count.
5. `05-trainings-filtered.png` — The same list with combined filters applied (search
   "run" + tag "easy" + 5–20 km), showing active filter chips (individually
   removable) and a "Clear all" action.
6. `06-weekly-schedule.png` — The new Weekly Schedule page for defining a reusable
   template (training type, title, target distance per weekday), used as the
   fallback plan for calendar weeks without an explicit override.
