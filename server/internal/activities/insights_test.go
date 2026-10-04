package activities

import (
	"testing"
	"time"
)

func workRep(start, length, meters, hr float64) Interval {
	return Interval{
		Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: start, Length: length,
		StartSeconds: start, EndSeconds: start + length, DurationSeconds: length,
		DistanceMeters: meters, AvgPaceSecondsPerKm: length / meters * 1000, AvgHeartRate: hr, MaxHeartRate: hr + 5,
	}
}

func segment(kind string, start, length float64) Interval {
	return Interval{Kind: kind, Basis: IntervalBasisTime, Start: start, Length: length, StartSeconds: start, EndSeconds: start + length, DurationSeconds: length}
}

func TestComputeEnduranceAnalyticsExcludesIntervalSessions(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC) // Saturday
	records := []FileRecord{
		{ID: "a", Status: "success", ActivityDate: "2026-09-08T08:00:00Z", DistanceMeters: 6000, DurationSeconds: 1800, AvgHeartRate: 150},
		{ID: "b", Status: "success", ActivityDate: "2026-09-10T08:00:00Z", DistanceMeters: 14000, DurationSeconds: 4200, AvgHeartRate: 160},
		{ID: "c", Status: "success", ActivityDate: "2026-09-09T08:00:00Z", DistanceMeters: 9000, DurationSeconds: 2700, WorkoutType: WorkoutTypeIntervals},
		{ID: "old", Status: "success", ActivityDate: "2025-01-01T08:00:00Z", DistanceMeters: 22000, DurationSeconds: 7000},
		{ID: "err", Status: "error", ActivityDate: "2026-09-10T08:00:00Z", DistanceMeters: 99999},
	}

	got := ComputeEnduranceAnalytics(records, 4, now)
	if got.RunCount != 2 || got.TotalDistanceMeters != 20000 {
		t.Fatalf("expected 2 runs / 20000 m in window, got %d / %v", got.RunCount, got.TotalDistanceMeters)
	}
	if got.LongestRun == nil || got.LongestRun.ActivityID != "b" {
		t.Fatalf("expected longest run in window to be b, got %+v", got.LongestRun)
	}
	if got.AvgPaceSecPerKm != 300 {
		t.Fatalf("expected distance-weighted pace 300 s/km, got %v", got.AvgPaceSecPerKm)
	}
	if len(got.Weekly) != 4 || !got.Weekly[3].IsCurrent || got.Weekly[3].LongestMeters != 14000 || got.Weekly[3].RunCount != 2 {
		t.Fatalf("unexpected current week: %+v", got.Weekly)
	}
	counts := map[string]int{}
	for _, b := range got.DistanceBands {
		counts[b.Label] = b.Count
	}
	if counts["5–8 km"] != 1 || counts["12–16 km"] != 1 || counts["21 km +"] != 1 {
		t.Fatalf("unexpected distance bands: %+v", got.DistanceBands)
	}
	if len(got.EfficiencyPoints) != 2 {
		t.Fatalf("expected efficiency points only for runs with heart rate, got %d", len(got.EfficiencyPoints))
	}
}

func TestComputeIntervalAnalyticsBuildsSessionsAndProgression(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	session := func(id, date string, paces ...float64) FileRecord {
		ivs := []Interval{segment(IntervalKindWarmup, 0, 600)}
		at := 600.0
		for i, p := range paces {
			ivs = append(ivs, workRep(at, 120, 120/p*1000, 170))
			at += 120
			if i < len(paces)-1 {
				ivs = append(ivs, segment(IntervalKindRecovery, at, 120))
				at += 120
			}
		}
		ivs = append(ivs, segment(IntervalKindCooldown, at, 600))
		return FileRecord{ID: id, Status: "success", ActivityDate: date, DurationSeconds: at + 600, DistanceMeters: 8000, WorkoutType: WorkoutTypeIntervals, Intervals: ivs}
	}
	records := []FileRecord{
		session("s2", "2026-09-08T17:00:00Z", 230, 225, 220),
		session("s1", "2026-08-25T17:00:00Z", 240, 240, 252),
		{ID: "unlabelled", Status: "success", ActivityDate: "2026-09-01T17:00:00Z", DurationSeconds: 3000, WorkoutType: WorkoutTypeIntervals},
		{ID: "easy", Status: "success", ActivityDate: "2026-09-10T08:00:00Z", DurationSeconds: 3000, DistanceMeters: 9000},
	}

	got := ComputeIntervalAnalytics(records, 4, now)
	if got.SessionCount != 2 || got.RepCount != 6 || got.WorkSeconds != 720 || got.UnlabelledCount != 1 {
		t.Fatalf("unexpected counters: %+v", got)
	}
	if len(got.Sessions) != 2 || got.Sessions[0].ActivityID != "s1" {
		t.Fatalf("expected sessions in chronological order, got %+v", got.Sessions)
	}
	latest := got.Sessions[1]
	if latest.Structure != "3 × 2:00" {
		t.Fatalf("unexpected structure %q", latest.Structure)
	}
	if latest.FadePercent == nil || *latest.FadePercent >= 0 {
		t.Fatalf("expected a negative fade (faster last rep), got %v", latest.FadePercent)
	}
	if fade := got.Sessions[0].FadePercent; fade == nil || *fade != 5 {
		t.Fatalf("expected +5%% fade for s1, got %v", fade)
	}
	if latest.RecoverySeconds != 240 || got.AvgWorkRestRatio != 1.5 {
		t.Fatalf("unexpected recovery %v / ratio %v", latest.RecoverySeconds, got.AvgWorkRestRatio)
	}
	if len(got.RepProgression) != 1 || got.RepProgression[0].Label != "2:00" || len(got.RepProgression[0].Points) != 2 {
		t.Fatalf("unexpected rep progression: %+v", got.RepProgression)
	}
	if p := got.RepProgression[0].Points[1].AvgPaceSecPerKm; p < 224 || p > 226 {
		t.Fatalf("expected latest 2:00 pace around 225 s/km, got %v", p)
	}
	totalSeconds := 0.0
	for _, w := range got.WeeklyQuality {
		totalSeconds += w.TotalSeconds
	}
	if got.WorkShare <= 0 || got.WorkShare >= 1 || totalSeconds == 0 {
		t.Fatalf("unexpected work share %v (total %v)", got.WorkShare, totalSeconds)
	}
}

func TestIntervalRepsWithGlitchedPaceAreNotTrusted(t *testing.T) {
	t.Parallel()

	rec := FileRecord{ID: "x", Status: "success", ActivityDate: "2026-09-08T17:00:00Z", WorkoutType: WorkoutTypeIntervals, Intervals: []Interval{
		workRep(0, 60, 214, 170),     // ~280 s/km
		workRep(120, 60, 210, 172),   // ~286 s/km
		workRep(240, 240, 1500, 175), // 160 s/km: far faster than the rest, a GPS glitch
		workRep(600, 60, 212, 174),
	}}
	s, ok := buildIntervalSession(rec)
	if !ok {
		t.Fatal("expected a session")
	}
	if s.Reps[2].Plausible || !s.Reps[0].Plausible {
		t.Fatalf("unexpected plausibility: %+v", s.Reps)
	}
	if s.WorkSeconds != 420 {
		t.Fatalf("glitched reps still count as work time, got %v", s.WorkSeconds)
	}
	if s.AvgWorkPace < 280 || s.AvgWorkPace > 286 {
		t.Fatalf("expected the glitch to be left out of the pace, got %v", s.AvgWorkPace)
	}
	if s.Structure != "2 × 1:00 · 4:00 · 1:00" {
		t.Fatalf("unexpected structure %q", s.Structure)
	}
}
