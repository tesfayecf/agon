package httpapi

import (
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/tesfayecf/agon/server/internal/activities"
)

// filterActivityRecords applies the Trainings search/filter query parameters:
//   - q: free-text search over name and tags
//   - tag: exact tag match (tags are stored as a comma-separated string)
//   - dateFrom / dateTo: inclusive activity date range (YYYY-MM-DD)
//   - minDistance / maxDistance: distance range in meters
//
// All filters are combinable (applied as AND).
func filterActivityRecords(records []activities.FileRecord, query url.Values) []activities.FileRecord {
	q := strings.ToLower(strings.TrimSpace(query.Get("q")))
	tag := strings.ToLower(strings.TrimSpace(query.Get("tag")))
	dateFrom := strings.TrimSpace(query.Get("dateFrom"))
	dateTo := strings.TrimSpace(query.Get("dateTo"))
	minDistance, hasMin := parseFloatParam(query.Get("minDistance"))
	maxDistance, hasMax := parseFloatParam(query.Get("maxDistance"))

	if q == "" && tag == "" && dateFrom == "" && dateTo == "" && !hasMin && !hasMax {
		return records
	}

	result := make([]activities.FileRecord, 0, len(records))
	for _, rec := range records {
		if q != "" {
			haystack := strings.ToLower(rec.Name + " " + rec.Tags)
			if !strings.Contains(haystack, q) {
				continue
			}
		}
		if tag != "" && !hasTag(rec.Tags, tag) {
			continue
		}
		if dateFrom != "" || dateTo != "" {
			day := activityDay(rec.ActivityDate)
			if day == "" {
				continue
			}
			if dateFrom != "" && day < dateFrom {
				continue
			}
			if dateTo != "" && day > dateTo {
				continue
			}
		}
		if hasMin && rec.DistanceMeters < minDistance {
			continue
		}
		if hasMax && rec.DistanceMeters > maxDistance {
			continue
		}
		result = append(result, rec)
	}
	return result
}

func hasTag(tagsField, wanted string) bool {
	for _, t := range strings.Split(tagsField, ",") {
		if strings.ToLower(strings.TrimSpace(t)) == wanted {
			return true
		}
	}
	return false
}

func activityDay(activityDate string) string {
	if activityDate == "" {
		return ""
	}
	if t, err := time.Parse(time.RFC3339, activityDate); err == nil {
		return t.UTC().Format("2006-01-02")
	}
	if len(activityDate) >= 10 {
		return activityDate[:10]
	}
	return ""
}

func parseFloatParam(raw string) (float64, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}
