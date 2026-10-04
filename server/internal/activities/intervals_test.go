package activities

import (
	"errors"
	"math"
	"testing"
	"time"
)

// syntheticRecords builds one record per second from (seconds, speed m/s, heart rate) phases.
func syntheticRecords(phases [][3]float64) []ActivityRecord {
	start := time.Date(2026, 9, 29, 17, 0, 0, 0, time.UTC)
	records := []ActivityRecord{}
	t := 0
	for _, p := range phases {
		for i := 0; i < int(p[0]); i++ {
			speed, hr := p[1], p[2]
			records = append(records, ActivityRecord{
				Timestamp: start.Add(time.Duration(t) * time.Second).Format(time.RFC3339),
				Speed:     &speed,
				HeartRate: &hr,
			})
			t++
		}
	}
	return records
}

func near(got, want, tol float64) bool { return math.Abs(got-want) <= tol }

// 300 s at 2.5 m/s (750 m), 120 s at 4 m/s (480 m), 60 s at 2 m/s (120 m), 120 s at 4 m/s (480 m).
func profile() []ActivityRecord {
	return syntheticRecords([][3]float64{{300, 2.5, 140}, {120, 4, 180}, {60, 2, 150}, {120, 4, 185}})
}

func TestResolveTimeBasedIntervals(t *testing.T) {
	t.Parallel()

	got, err := ResolveIntervals(profile(), []Interval{
		{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 300, Length: 120, Label: "Rep 1"},
		{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 480, Length: 120, Label: "Rep 2"},
	})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	rep1 := got[0]
	if rep1.StartSeconds != 300 || rep1.EndSeconds != 420 || rep1.DurationSeconds != 120 {
		t.Fatalf("unexpected time range: %+v", rep1)
	}
	if !near(rep1.DistanceMeters, 480, 0.5) || !near(rep1.AvgPaceSecondsPerKm, 250, 0.5) {
		t.Fatalf("expected 480 m at 250 s/km, got %+v", rep1)
	}
	if rep1.StartMeters != 750 || rep1.EndMeters != 1230 {
		t.Fatalf("expected meters 750–1230, got %.1f–%.1f", rep1.StartMeters, rep1.EndMeters)
	}
	if rep1.AvgHeartRate != 180 || rep1.MaxHeartRate != 180 {
		t.Fatalf("expected HR 180, got avg %.1f max %.1f", rep1.AvgHeartRate, rep1.MaxHeartRate)
	}
	if got[1].AvgHeartRate != 185 {
		t.Fatalf("expected rep 2 HR 185, got %.1f", got[1].AvgHeartRate)
	}
}

func TestResolveDistanceBasedIntervals(t *testing.T) {
	t.Parallel()

	// 750 m is where the first fast phase starts (t=300 s); 480 m of it takes 120 s.
	got, err := ResolveIntervals(profile(), []Interval{
		{Kind: IntervalKindWork, Basis: IntervalBasisDistance, Start: 750, Length: 480},
	})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	iv := got[0]
	if !near(iv.StartSeconds, 300, 0.01) || !near(iv.EndSeconds, 420, 0.01) {
		t.Fatalf("expected 300–420 s, got %.2f–%.2f", iv.StartSeconds, iv.EndSeconds)
	}
	if !near(iv.AvgPaceSecondsPerKm, 250, 0.5) || iv.AvgHeartRate != 180 {
		t.Fatalf("unexpected stats: %+v", iv)
	}

	// 1000 m falls half-way through the first fast phase: 750 + 4·62.5 s.
	got, _ = ResolveIntervals(profile(), []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisDistance, Start: 1000, Length: 200}})
	if !near(got[0].StartSeconds, 362.5, 0.1) || !near(got[0].DurationSeconds, 50, 0.1) {
		t.Fatalf("expected start 362.5 s and 50 s duration, got %+v", got[0])
	}
}

func TestResolveSortsByStart(t *testing.T) {
	t.Parallel()

	got, err := ResolveIntervals(profile(), []Interval{
		{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 480, Length: 120},
		{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 300, Length: 120},
	})
	if err != nil || got[0].StartSeconds != 300 || got[1].StartSeconds != 480 {
		t.Fatalf("expected intervals sorted by start, got %+v %v", got, err)
	}
}

func TestResolveRejectsStartAfterEnd(t *testing.T) {
	t.Parallel()

	_, err := ResolveIntervals(profile(), []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 700, Length: 60}})
	if !errors.Is(err, ErrInvalidWorkout) {
		t.Fatalf("expected ErrInvalidWorkout for a start past the end, got %v", err)
	}
	_, err = ResolveIntervals(profile(), []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisDistance, Start: 5000, Length: 100}})
	if !errors.Is(err, ErrInvalidWorkout) {
		t.Fatalf("expected ErrInvalidWorkout for a distance past the end, got %v", err)
	}
}

func TestResolveClampsLongIntervalToEnd(t *testing.T) {
	t.Parallel()

	got, err := ResolveIntervals(profile(), []Interval{{Kind: IntervalKindCooldown, Basis: IntervalBasisTime, Start: 480, Length: 500}})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got[0].EndSeconds != 600 || got[0].DurationSeconds != 120 {
		t.Fatalf("expected clamp to 600 s, got %+v", got[0])
	}
}

func TestResolveRejectsOverlap(t *testing.T) {
	t.Parallel()

	_, err := ResolveIntervals(profile(), []Interval{
		{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 300, Length: 120},
		{Kind: IntervalKindRecovery, Basis: IntervalBasisDistance, Start: 1000, Length: 100}, // starts at 362.5 s
	})
	if !errors.Is(err, ErrInvalidWorkout) {
		t.Fatalf("expected overlap error across bases, got %v", err)
	}
}

func TestResolveWithoutTrackData(t *testing.T) {
	t.Parallel()

	got, err := ResolveIntervals(nil, []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 60, Length: 120}})
	if err != nil || got[0].DurationSeconds != 120 || got[0].AvgPaceSecondsPerKm != 0 {
		t.Fatalf("expected duration without stats, got %+v %v", got, err)
	}
	if _, err := ResolveIntervals(nil, []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisDistance, Start: 0, Length: 400}}); !errors.Is(err, ErrInvalidWorkout) {
		t.Fatalf("expected distance basis to need track data, got %v", err)
	}
}

func TestResolveDerivesSpeedFromDistanceOnlyRecords(t *testing.T) {
	t.Parallel()

	records := profile()
	dist := 0.0
	for i := range records {
		dist += *records[i].Speed
		d := dist
		records[i].Distance = &d
		records[i].Speed = nil
	}
	got, err := ResolveIntervals(records, []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 300, Length: 120}})
	if err != nil || !near(got[0].AvgPaceSecondsPerKm, 250, 2) {
		t.Fatalf("expected ~250 s/km from distance-only records, got %+v %v", got, err)
	}
}

func TestValidateWorkout(t *testing.T) {
	t.Parallel()

	got, err := ValidateWorkout(WorkoutTypeIntervals, []Interval{{Kind: IntervalKindWork, Start: 10, Length: 60}})
	if err != nil || got[0].Basis != IntervalBasisTime {
		t.Fatalf("expected basis to default to time, got %+v %v", got, err)
	}

	valid := []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 0, Length: 60}}
	cases := map[string]struct {
		workoutType string
		intervals   []Interval
	}{
		"unknown type":          {"sprint", nil},
		"intervals on easy run": {WorkoutTypeEasy, valid},
		"unknown kind":          {WorkoutTypeIntervals, []Interval{{Kind: "jog", Start: 0, Length: 10}}},
		"unknown basis":         {WorkoutTypeIntervals, []Interval{{Kind: IntervalKindWork, Basis: "laps", Start: 0, Length: 10}}},
		"zero length":           {WorkoutTypeIntervals, []Interval{{Kind: IntervalKindWork, Start: 0, Length: 0}}},
		"negative start":        {WorkoutTypeIntervals, []Interval{{Kind: IntervalKindWork, Start: -1, Length: 5}}},
	}
	for name, tc := range cases {
		if _, err := ValidateWorkout(tc.workoutType, tc.intervals); !errors.Is(err, ErrInvalidWorkout) {
			t.Errorf("%s: expected ErrInvalidWorkout, got %v", name, err)
		}
	}

	if _, err := ValidateWorkout(WorkoutTypeHills, nil); err != nil {
		t.Fatalf("expected hills to be a valid workout type, got %v", err)
	}
	if _, err := ValidateWorkout(WorkoutTypeHills, valid); !errors.Is(err, ErrInvalidWorkout) {
		t.Fatalf("expected intervals on a hills run to be rejected, got %v", err)
	}

	if cleared, err := ValidateWorkout("", nil); err != nil || len(cleared) != 0 {
		t.Fatalf("expected clearing the workout type to be valid, got %v %v", cleared, err)
	}
}
