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
