# Agon Roadmap

> Living document — priorities shift with feedback. Items are ordered by
> estimated impact, not by chronology.

---

## 1. Route / Map Visualization

**Impact**: High — every training app renders routes; this is the most visible gap.

FIT and TCX files carry GPS coordinates (`latitude`/`longitude` in
`ActivityRecord`) but the activity detail page shows only a table of records.
Runners instinctively want to see *where* they ran.

### What it would take

- **Backend**: The detail endpoint already returns `records[]` with lat/lon.
  Optionally add a simplified polyline endpoint to reduce payload size.
- **Frontend**: A `<canvas>`-based polyline renderer, or embed a lightweight
  vector map. A minimal approach: render a 2D polyline (distance vs. lat/lon)
  with a start/end marker, elevation colored trace, and a hover tooltip showing
  time/pace at each point.
- **Map tiles (future)**: Drop in [MapLibre GL JS](https://maplibre.org/) or
  [Leaflet](https://leafletjs.com/) with a free tile source (OpenStreetMap via
  CartoDB or Protomaps) to show the route on a real basemap.

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Backend polyline endpoint | 1–2 days | Existing `/api/activities/{id}` |
| Canvas polyline renderer | 2–3 days | — |
| Map tile integration | 3–5 days | Polyline renderer |

---

## 2. Training Load / Fitness Trend (CTL / ATL / TSB)

**Impact**: High — gives athletes a concrete answer to "am I fitter than last
month?" and "am I overreaching?".

The "Performance Manager" chart (Chronic Training Load, Acute Training Load,
Training Stress Balance) is popularised by TrainingPeaks and WKO. It computes
a weighted 42-day (CTL) and 7-day (ATL) rolling average of Training Stress
Score (TSS), then shows the balance (TSB = CTL − ATL).

### Data already available
- `durationSeconds` per activity
- `distanceMeters`  
- `avgHeartRate` (used to compute intensity factor)
- Resting / max heart rate from `PUT /api/profile`

### What it would take

- **Computation (server)**: TSS per activity = `(duration × IF² × 100) / 36`
  where IF (Intensity Factor) = `avg HR / lactate threshold HR` (or a proxy
  using HR reserve). Rolling averages via exponential smoothing.
- **Endpoint**: `GET /api/analytics/training-load` returning daily CTL, ATL,
  TSB for the last 90+ days.
- **Frontend**: A line chart (reuse `LineTrendChart` or `BarTrendChart`) with
  three filled areas — green (fresh), yellow (neutral), red (strain).

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| TSS computation + endpoint | 2–3 days | Existing activity data, profile HR |
| Frontend chart | 2–3 days | Existing chart components |

---

## 3. Split Analysis (per‑km / per‑mile splits)

**Impact**: Medium — highly expected on any activity detail page.

Runners naturally ask "how was my 5th km compared to my 1st?" The records are
timestamped with cumulative distance, so splitting them by km (or mile) is
straightforward.

### What it would take

- **Backend**: A `GET /api/activities/{id}/splits` endpoint that chunks records
  by distance and returns per-split: start time, avg pace, avg heart rate,
  elevation change, duration.
- **Frontend**: A compact table added to `TrackDetailPage` below the record
  table, plus a small inline bar chart showing pace per split (green when
  faster than overall avg, red when slower).

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Splits endpoint | 1–2 days | Existing records |
| Frontend table + mini chart | 1–2 days | — |

---

## 4. Pace Zone / Heart Rate Zone — Time in Zone

**Impact**: Medium — makes intensity distribution visible and actionable.

With resting HR and max HR stored in the profile, HR zones (Z1–Z5) are
computable. The activity records already carry `heartRate` per second, so
summing time spent in each zone is a pure frontend computation (or cheap
server-side).

### What it would take

- **Backend**: Zone definitions from profile (or standard % of HR reserve).
  Optional endpoint `GET /api/activities/{id}/zones` or compute on the fly.
- **Frontend**: A horizontal stacked bar per activity showing time in Z1–Z5,
  with a toggle for pace zones vs HR zones. An aggregated "weekly zone
  distribution" on the dashboard.

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Zone computation | 1 day | Profile HR |
| Activity zone bar | 1–2 days | — |
| Dashboard weekly zone chart | 2 days | Existing chart components |

---

## 5. Activity Comparison

**Impact**: Medium — useful for comparing a workout against a previous attempt
or a planned session.

### What it would take

- **Frontend**: A split-view or overlay page where the user picks two
  activities. Their pace, HR, and elevation profiles are drawn on the same
  chart axes with a legend. Reuse the existing line-chart components; the hard
  part is UI (picking, aligning by distance).
- **Backend**: No new endpoint needed — just fetch two existing activity
  details.

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Comparison picker UI | 1 day | — |
| Overlay chart | 2–3 days | Existing chart components |

---

## 6. Progressive Overload & Consistency Metrics

**Impact**: Medium — helps athletes see whether training volume is trending up,
flat, or down relative to their plan.

### What it would take

- **Backend**: A `GET /api/analytics/consistency` endpoint returning:
  - Current streak (consecutive days with a logged activity)
  - Days trained this week / last 4 weeks
  - 4-week average volume vs. previous 4 weeks (trend arrow)
  - Weekly load relative to training plan target
- **Frontend**: A compact "Consistency" card on the dashboard showing the
  streak badge, a small sparkline of weekly volume, and an up/down/flat arrow.

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Consistency endpoint | 1 day | Existing activity data |
| Dashboard card | 1 day | — |

---

## 7. Shoe Tracking

**Impact**: Low–Medium — runners love this, but it's a niche feature.

### What it would take

- **Backend**: A `shoes` table (SQLite), `GET/PUT /api/shoes` endpoints, a
  `shoe_id` column on activities. Cumulative mileage computed on write.
- **Frontend**: A shoe manager page + a shoe picker on the activity detail /
  upload page.

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Shoes table + endpoints | 1–2 days | SQLite |
| Frontend shoe manager | 2 days | — |

---

## 8. Export / Backup

**Impact**: Low — table-stakes for a self-hosted app; low urgency.

### What it would take

- **Backend**: A `GET /api/export` endpoint that packages activities + plans as
  JSON (or CSV). The SQLite backup mechanism already exists in
  `server/internal/sqlite/`.
- **Frontend**: A single "Export data" button on the Settings page.

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Export endpoint | 1 day | Existing data |
| Settings button | 0.5 day | — |

---

## 9. Dynamic Training Plan Adjustments

**Impact**: Low — ambitious, requires plan-versus-actual comparison engine.

The training plan is generated once (via MCP) and never updated based on
what the athlete actually completed. A future version could compare completed
sessions against planned sessions and suggest adjustments (or auto-adjust the
remaining weeks).

### Rough scope
| Layer | Est. effort | Depends on |
|-------|-------------|------------|
| Plan-vs-actual comparison | 3–5 days | Training plan sessions + completed activities |
| Auto-adjust / recommend | 5+ days (research) | Comparison engine |

---

## Prioritisation

```
Now (short-term)         Next (medium-term)      Later
──────────────────────   ──────────────────────   ───────────
Route map visualisation  Activity comparison     Shoe tracking
Training load (CTL/ATL)  Progressive overload    Export/backup
Split analysis           Dynamic plan adjust.    Notifications
Pace/HR zone analysis
```

**Recommended first three** (highest value per unit of effort):

1. **Route map** — biggest visibility gap, data ready
2. **Training load trend** — deep analytics with no new input data needed
3. **Split analysis** — quick win on the activity detail page