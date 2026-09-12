package activities

import (
	"testing"
	"time"
)

func TestWeeklyTrendZeroFillsAndSumsCurrentWeek(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC) // Saturday
	records := []FileRecord{
		{Status: "success", ActivityDate: "2026-09-08T08:00:00Z", DistanceMeters: 5000},
		{Status: "success", ActivityDate: "2026-09-10T08:00:00Z", DistanceMeters: 3000},
		{Status: "error", ActivityDate: "2026-09-10T08:00:00Z", DistanceMeters: 999999},
	}

	points := WeeklyTrend(records, 3, now)
	if len(points) != 3 {
		t.Fatalf("expected 3 weeks, got %d", len(points))
	}
	last := points[len(points)-1]
	if !last.IsCurrent {
		t.Fatalf("expected last point to be current week")
	}
	if last.DistanceMeters != 8000 {
		t.Fatalf("expected current week distance 8000, got %v", last.DistanceMeters)
	}
	if last.SessionCount != 2 {
		t.Fatalf("expected 2 completed sessions, got %d", last.SessionCount)
	}
	first := points[0]
	if first.DistanceMeters != 0 {
		t.Fatalf("expected empty week to be zero-filled, got %v", first.DistanceMeters)
	}
}

func TestMonthlyTrendIncludesZeroMonths(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	records := []FileRecord{
		{Status: "success", ActivityDate: "2026-09-01T08:00:00Z", DistanceMeters: 10000},
	}

	points := MonthlyTrend(records, 3, now)
	if len(points) != 3 {
		t.Fatalf("expected 3 months, got %d", len(points))
	}
	if points[2].Month != "2026-09" || points[2].DistanceMeters != 10000 {
		t.Fatalf("unexpected current month bucket: %+v", points[2])
	}
	if points[0].DistanceMeters != 0 {
		t.Fatalf("expected earliest month to be zero, got %+v", points[0])
	}
}

func TestPaceTrendOmitsWeeksWithoutQualifyingData(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	records := []FileRecord{
		{Status: "success", ActivityDate: "2026-09-08T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 1500},
	}

	points := PaceTrend(records, 4, now)
	if len(points) != 1 {
		t.Fatalf("expected only the week with data, got %d points", len(points))
	}
	if points[0].AvgPaceSecPerKm != 300 {
		t.Fatalf("expected pace 300 sec/km, got %v", points[0].AvgPaceSecPerKm)
	}
}

func TestHeartRateTrendOmitsWeeksWithoutHRData(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC)
	records := []FileRecord{
		{Status: "success", ActivityDate: "2026-09-08T08:00:00Z", DistanceMeters: 5000, AvgHeartRate: 150},
		{Status: "success", ActivityDate: "2026-09-01T08:00:00Z", DistanceMeters: 4000},
	}

	points := HeartRateTrend(records, 4, now)
	if len(points) != 1 {
		t.Fatalf("expected only weeks with HR data, got %d", len(points))
	}
	if points[0].AvgHeartRate != 150 {
		t.Fatalf("expected avg HR 150, got %v", points[0].AvgHeartRate)
	}
}

func TestPersonalBestsOnlyAcceptsQualifyingDistances(t *testing.T) {
	t.Parallel()

	records := []FileRecord{
		{ID: "a", Status: "success", ActivityDate: "2026-01-01T08:00:00Z", DistanceMeters: 4900, DurationSeconds: 1000}, // too short for 5k
		{ID: "b", Status: "success", ActivityDate: "2026-02-01T08:00:00Z", DistanceMeters: 5050, DurationSeconds: 1200}, // qualifies, slower
		{ID: "c", Status: "success", ActivityDate: "2026-03-01T08:00:00Z", DistanceMeters: 5010, DurationSeconds: 1100}, // qualifies, faster
		{ID: "d", Status: "success", ActivityDate: "2026-04-01T08:00:00Z", DistanceMeters: 6000, DurationSeconds: 1000}, // too far over 5% tolerance
	}

	bests := PersonalBests(records)
	var fiveK *PersonalBest
	for i := range bests {
		if bests[i].Label == "5 km" {
			fiveK = &bests[i]
		}
	}
	if fiveK == nil {
		t.Fatalf("expected a 5 km personal best")
	}
	if fiveK.ActivityID != "c" || fiveK.BestSeconds != 1100 {
		t.Fatalf("expected activity c (1100s) to be the 5km PB, got %+v", fiveK)
	}
}

func TestPaceHeartRateSeriesOrdersChronologicallyAndFiltersUnreliableData(t *testing.T) {
	t.Parallel()

	records := []FileRecord{
		{ID: "a", Name: "Later run", Status: "success", ActivityDate: "2026-02-01T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 1500, AvgHeartRate: 150},
		{ID: "b", Name: "Earlier run", Status: "success", ActivityDate: "2026-01-01T08:00:00Z", DistanceMeters: 10000, DurationSeconds: 3000, AvgHeartRate: 140},
		{ID: "c", Name: "No heart rate", Status: "success", ActivityDate: "2026-01-15T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 1500, AvgHeartRate: 0},
		{ID: "d", Name: "Too short", Status: "success", ActivityDate: "2026-01-20T08:00:00Z", DistanceMeters: 200, DurationSeconds: 60, AvgHeartRate: 130},
		{ID: "e", Name: "Failed upload", Status: "error", ActivityDate: "2026-01-25T08:00:00Z", DistanceMeters: 5000, DurationSeconds: 1500, AvgHeartRate: 145},
	}

	points := PaceHeartRateSeries(records)
	if len(points) != 2 {
		t.Fatalf("expected 2 qualifying points, got %d: %+v", len(points), points)
	}
	if points[0].ActivityID != "b" || points[1].ActivityID != "a" {
		t.Fatalf("expected chronological order b, a; got %s, %s", points[0].ActivityID, points[1].ActivityID)
	}
	if points[0].PaceSecPerKm != 300 {
		t.Fatalf("expected pace 300 sec/km for a 10km/3000s run, got %v", points[0].PaceSecPerKm)
	}
}

func TestCurrentWeekAndMonthDistance(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC) // Saturday, week Mon 2026-09-07..Sun 2026-09-13
	records := []FileRecord{
		{Status: "success", ActivityDate: "2026-09-08T08:00:00Z", DistanceMeters: 5000},
		{Status: "success", ActivityDate: "2026-08-30T08:00:00Z", DistanceMeters: 7000}, // previous week, same month? Aug -> not counted for month or week
	}

	weekDistance, weekCount := CurrentWeekDistance(records, now)
	if weekDistance != 5000 || weekCount != 1 {
		t.Fatalf("expected week distance 5000/1 session, got %v/%d", weekDistance, weekCount)
	}

	monthDistance, monthCount := CurrentMonthDistance(records, now)
	if monthDistance != 5000 || monthCount != 1 {
		t.Fatalf("expected month distance 5000/1 session, got %v/%d", monthDistance, monthCount)
	}
}

// daysAgo formats an RFC3339 timestamp `n` days before `now`, for building fixture records.
func daysAgo(now time.Time, n int) string {
	return now.AddDate(0, 0, -n).Format(time.RFC3339)
}

func TestComputeTrainingLoadInsufficientDataWhenEmpty(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)

	load := ComputeTrainingLoad(nil, now)
	if load.Status != LoadStatusInsufficientData || load.HasEnoughHistory {
		t.Fatalf("expected insufficient_data with no records, got %+v", load)
	}
}

func TestComputeTrainingLoadInsufficientDataWithThinHistory(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	// Only 3 days of history exist at all — below minHistoryDaysForRatio.
	records := []FileRecord{
		{Status: "success", ActivityDate: daysAgo(now, 1), DistanceMeters: 5000},
		{Status: "success", ActivityDate: daysAgo(now, 3), DistanceMeters: 5000},
	}

	load := ComputeTrainingLoad(records, now)
	if load.Status != LoadStatusInsufficientData {
		t.Fatalf("expected insufficient_data with only 3 days of history, got %+v", load)
	}
}

func TestComputeTrainingLoadOptimalWhenSteady(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	// A steady 10km every other day for the last 28 days: acute and chronic
	// weekly volumes should match closely, landing in the "optimal" band.
	records := make([]FileRecord, 0, 14)
	for d := 1; d <= 28; d += 2 {
		records = append(records, FileRecord{Status: "success", ActivityDate: daysAgo(now, d), DistanceMeters: 10000})
	}

	load := ComputeTrainingLoad(records, now)
	if !load.HasEnoughHistory {
		t.Fatalf("expected enough history, got %+v", load)
	}
	if load.Status != LoadStatusOptimal {
		t.Fatalf("expected optimal status for steady load, got %+v", load)
	}
	if load.Ratio < 0.8 || load.Ratio > 1.3 {
		t.Fatalf("expected ratio within [0.8, 1.3] for steady load, got %v", load.Ratio)
	}
}

func TestComputeTrainingLoadHighWhenRecentSpike(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	// Light training weeks 2-4 ago, then a big spike in the last 7 days.
	records := []FileRecord{
		{Status: "success", ActivityDate: daysAgo(now, 10), DistanceMeters: 5000},
		{Status: "success", ActivityDate: daysAgo(now, 17), DistanceMeters: 5000},
		{Status: "success", ActivityDate: daysAgo(now, 24), DistanceMeters: 5000},
		{Status: "success", ActivityDate: daysAgo(now, 1), DistanceMeters: 20000},
		{Status: "success", ActivityDate: daysAgo(now, 2), DistanceMeters: 20000},
		{Status: "success", ActivityDate: daysAgo(now, 3), DistanceMeters: 20000},
	}

	load := ComputeTrainingLoad(records, now)
	if load.Status != LoadStatusHigh {
		t.Fatalf("expected high status for a sharp recent spike, got %+v", load)
	}
	if load.Ratio <= 1.5 {
		t.Fatalf("expected ratio > 1.5 for a sharp spike, got %v", load.Ratio)
	}
}

func TestComputeTrainingLoadLowWhenTaperingOff(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	// Consistent training in weeks 2-4 ago, nothing in the last 7 days.
	records := []FileRecord{
		{Status: "success", ActivityDate: daysAgo(now, 10), DistanceMeters: 15000},
		{Status: "success", ActivityDate: daysAgo(now, 17), DistanceMeters: 15000},
		{Status: "success", ActivityDate: daysAgo(now, 24), DistanceMeters: 15000},
	}

	load := ComputeTrainingLoad(records, now)
	if load.Status != LoadStatusLow {
		t.Fatalf("expected low status when acute volume drops to zero, got %+v", load)
	}
	if load.AcuteDistanceMeters != 0 {
		t.Fatalf("expected zero acute distance, got %v", load.AcuteDistanceMeters)
	}
}

func TestComputeTrainingLoadNormalizesChronicWindowForNewAccounts(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)
	// Only 14 days of history exist (first activity 13 days ago), evenly spread,
	// so the chronic average should be normalized by ~2 weeks, not always by 4 —
	// otherwise a new account would look artificially "low" simply for being new.
	records := []FileRecord{
		{Status: "success", ActivityDate: daysAgo(now, 1), DistanceMeters: 10000},
		{Status: "success", ActivityDate: daysAgo(now, 3), DistanceMeters: 10000},
		{Status: "success", ActivityDate: daysAgo(now, 5), DistanceMeters: 10000},
		{Status: "success", ActivityDate: daysAgo(now, 8), DistanceMeters: 10000},
		{Status: "success", ActivityDate: daysAgo(now, 10), DistanceMeters: 10000},
		{Status: "success", ActivityDate: daysAgo(now, 13), DistanceMeters: 10000},
	}

	load := ComputeTrainingLoad(records, now)
	if load.Status != LoadStatusOptimal {
		t.Fatalf("expected optimal status once normalized for a ~2-week-old account, got %+v", load)
	}
}
