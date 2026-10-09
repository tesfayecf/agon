package httpapi

import (
	"net/url"
	"testing"

	"github.com/tesfayecf/agon/server/internal/activities"
)

func sampleRecords() []activities.FileRecord {
	return []activities.FileRecord{
		{ID: "1", Name: "Morning intervals", Tags: "intervals,track", ActivityDate: "2026-01-10T08:00:00Z", DistanceMeters: 8000},
		{ID: "2", Name: "Easy jog", Tags: "easy", ActivityDate: "2026-01-20T08:00:00Z", DistanceMeters: 6000},
		{ID: "3", Name: "Long run", Tags: "long,easy", ActivityDate: "2026-02-05T08:00:00Z", DistanceMeters: 18000},
	}
}

func TestFilterActivityRecordsByTag(t *testing.T) {
	t.Parallel()
	q := url.Values{"tag": {"easy"}}
	result := filterActivityRecords(sampleRecords(), q)
	if len(result) != 2 {
		t.Fatalf("expected 2 records tagged easy, got %d", len(result))
	}
}

func TestFilterActivityRecordsBySearchText(t *testing.T) {
	t.Parallel()
	q := url.Values{"q": {"interval"}}
	result := filterActivityRecords(sampleRecords(), q)
	if len(result) != 1 || result[0].ID != "1" {
		t.Fatalf("expected only record 1, got %+v", result)
	}
}

func TestFilterActivityRecordsCombinesDateAndDistance(t *testing.T) {
	t.Parallel()
	q := url.Values{
		"tag":         {"intervals"},
		"dateFrom":    {"2026-01-01"},
		"dateTo":      {"2026-01-31"},
		"minDistance": {"5000"},
		"maxDistance": {"15000"},
	}
	result := filterActivityRecords(sampleRecords(), q)
	if len(result) != 1 || result[0].ID != "1" {
		t.Fatalf("expected only record 1 to match combined filters, got %+v", result)
	}
}

func TestFilterActivityRecordsZeroResults(t *testing.T) {
	t.Parallel()
	q := url.Values{"tag": {"swimming"}}
	result := filterActivityRecords(sampleRecords(), q)
	if len(result) != 0 {
		t.Fatalf("expected zero results, got %d", len(result))
	}
}

func TestFilterActivityRecordsNoFiltersReturnsAll(t *testing.T) {
	t.Parallel()
	result := filterActivityRecords(sampleRecords(), url.Values{})
	if len(result) != 3 {
		t.Fatalf("expected all 3 records with no filters, got %d", len(result))
	}
}
