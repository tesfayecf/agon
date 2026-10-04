package activities

import (
	"math"
	"testing"
	"time"
)

func TestPredictRaceSecondsMatchesDanielsTables(t *testing.T) {
	t.Parallel()

	// Daniels' Running Formula, VDOT 50.
	cases := []struct {
		meters float64
		want   float64
	}{
		{5000, 19*60 + 57},
		{10000, 41*60 + 21},
		{21097.5, 1*3600 + 31*60 + 35},
		{42195, 3*3600 + 10*60 + 49},
	}
	for _, c := range cases {
		got := PredictRaceSeconds(50, c.meters)
		if math.Abs(got-c.want) > 15 {
			t.Fatalf("%.0f m: expected ~%.0fs, got %.0fs", c.meters, c.want, got)
		}
	}
}

func TestVDOTForPerformanceRoundTrips(t *testing.T) {
	t.Parallel()

	vdot := VDOTForPerformance(10000, 45*60)
	if got := PredictRaceSeconds(vdot, 10000); math.Abs(got-45*60) > 1 {
		t.Fatalf("expected round trip to 2700s, got %v", got)
	}
}

func TestRacePredictorUsesBestEffortWithoutHeartRateProfile(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	records := []FileRecord{
		{ID: "a", Status: "success", ActivityDate: "2026-09-28T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 20 * 60, AvgHeartRate: 170},
		{ID: "b", Status: "success", ActivityDate: "2026-09-30T08:00:00Z", DistanceMeters: 10000, DurationSeconds: 55 * 60, AvgHeartRate: 140},
		// Ignored: interval session, too short, outside window, failed parse.
		{ID: "c", Status: "success", WorkoutType: WorkoutTypeIntervals, ActivityDate: "2026-10-01T08:00:00Z", DistanceMeters: 8000, DurationSeconds: 25 * 60},
		{ID: "d", Status: "success", ActivityDate: "2026-10-02T08:00:00Z", DistanceMeters: 1000, DurationSeconds: 3 * 60},
		{ID: "e", Status: "success", ActivityDate: "2025-01-01T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 15 * 60},
		{ID: "f", Status: "error", ActivityDate: "2026-10-02T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 15 * 60},
	}

	got := ComputeRacePredictor(records, HeartRateBounds{}, now)
	if got.Method != PredictionMethodBestEffort || got.SampleCount != 2 {
		t.Fatalf("unexpected method/sample count: %s/%d", got.Method, got.SampleCount)
	}
	if got.Basis == nil || got.Basis.ActivityID != "a" {
		t.Fatalf("expected the 5 km effort as basis, got %+v", got.Basis)
	}
	if got.HasHeartRateProfile {
		t.Fatalf("expected no heart-rate profile")
	}
	if len(got.Predictions) != 4 {
		t.Fatalf("expected 4 predictions, got %d", len(got.Predictions))
	}
	if five := got.Predictions[0]; math.Abs(five.PredictedSeconds-20*60) > 2 {
		t.Fatalf("expected 5 km prediction to equal the 20:00 effort, got %v", five.PredictedSeconds)
	}
	if marathon := got.Predictions[3]; !marathon.IsExtrapolated {
		t.Fatalf("expected marathon to be flagged as extrapolated from a 10 km longest run")
	}
	if half := got.Predictions[2]; half.IsExtrapolated {
		t.Fatalf("half marathon is within 4x the longest run and should not be flagged")
	}
}

func TestRacePredictorHeartRateRaisesSubmaximalEstimate(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	// Steady 10 km at 5:00/km and 75% of heart-rate reserve: well below race effort.
	records := []FileRecord{
		{ID: "a", Status: "success", ActivityDate: "2026-09-29T08:00:00Z", DistanceMeters: 10000, DurationSeconds: 50 * 60, AvgHeartRate: 160},
	}

	without := ComputeRacePredictor(records, HeartRateBounds{}, now)
	with := ComputeRacePredictor(records, HeartRateBounds{Resting: 50, Max: 196.7}, now)
	if with.Method != PredictionMethodHeartRate {
		t.Fatalf("expected heart_rate method, got %s", with.Method)
	}
	if with.VDOT <= without.VDOT {
		t.Fatalf("expected effort-adjusted VDOT above best effort (%v), got %v", without.VDOT, with.VDOT)
	}
}

func TestRacePredictorHeartRateNeverBelowDemonstratedEffort(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	// Average heart rate at max (e.g. a bad max-HR setting) would imply a lower VDOT
	// than the run itself proves; the demonstrated effort wins.
	records := []FileRecord{
		{ID: "a", Status: "success", ActivityDate: "2026-09-29T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 19 * 60, AvgHeartRate: 185},
	}
	got := ComputeRacePredictor(records, HeartRateBounds{Resting: 50, Max: 185}, now)
	if got.Method != PredictionMethodBestEffort {
		t.Fatalf("expected best_effort floor, got %s (vdot %v)", got.Method, got.VDOT)
	}
}

func TestRacePredictorEmptyWithoutQualifyingRuns(t *testing.T) {
	t.Parallel()

	got := ComputeRacePredictor(nil, HeartRateBounds{}, time.Now())
	if got.Method != PredictionMethodNone || got.Basis != nil {
		t.Fatalf("expected no prediction, got %+v", got)
	}
	if got.Predictions == nil || got.Trend == nil {
		t.Fatalf("expected empty, non-nil slices for JSON")
	}
}
