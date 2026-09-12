package activities

import (
	"math"
	"sort"
	"time"
)

// WeeklyTrendPoint represents total completed training distance for one Monday-starting week.
type WeeklyTrendPoint struct {
	WeekStart      string  `json:"weekStart"`
	DistanceMeters float64 `json:"distanceMeters"`
	SessionCount   int     `json:"sessionCount"`
	IsCurrent      bool    `json:"isCurrent"`
}

// MonthlyTrendPoint represents total completed training distance for one calendar month.
type MonthlyTrendPoint struct {
	Month          string  `json:"month"` // YYYY-MM
	DistanceMeters float64 `json:"distanceMeters"`
	SessionCount   int     `json:"sessionCount"`
	IsCurrent      bool    `json:"isCurrent"`
}

// PaceTrendPoint represents the distance-weighted average pace for one Monday-starting week.
type PaceTrendPoint struct {
	WeekStart       string  `json:"weekStart"`
	AvgPaceSecPerKm float64 `json:"avgPaceSecondsPerKm"`
	DistanceMeters  float64 `json:"distanceMeters"`
	IsCurrent       bool    `json:"isCurrent"`
}

// HeartRateTrendPoint represents the average heart rate for one Monday-starting week.
type HeartRateTrendPoint struct {
	WeekStart      string  `json:"weekStart"`
	AvgHeartRate   float64 `json:"avgHeartRate"`
	DistanceMeters float64 `json:"distanceMeters"`
	IsCurrent      bool    `json:"isCurrent"`
}

// PersonalBest is the fastest recorded completed time for a well-known distance.
type PersonalBest struct {
	Label          string  `json:"label"`
	DistanceMeters float64 `json:"distanceMeters"`
	BestSeconds    float64 `json:"bestSeconds"`
	Date           string  `json:"date"`
	ActivityID     string  `json:"activityId"`
	ActivityName   string  `json:"activityName"`
}

var personalBestDistances = []struct {
	Label  string
	Meters float64
}{
	{"1 km", 1000},
	{"5 km", 5000},
	{"10 km", 10000},
	{"Half marathon", 21097.5},
	{"Marathon", 42195},
}

// personalBestToleranceRatio allows a recorded activity to be slightly longer than the
// target distance (GPS drift, route rounding) while still counting as a valid attempt.
// It never allows a shorter distance to count, since that would be an approximation, not
// an exact performance for the target distance.
const personalBestToleranceRatio = 1.05

func parseActivityDate(value string) (time.Time, bool) {
	if value == "" {
		return time.Time{}, false
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t.UTC(), true
	}
	if t, err := time.Parse("2006-01-02T15:04:05", value); err == nil {
		return t.UTC(), true
	}
	return time.Time{}, false
}

// mondayStart returns midnight UTC of the Monday on/before the given time.
func mondayStart(t time.Time) time.Time {
	t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	offset := (int(t.Weekday()) + 6) % 7 // Monday=0 .. Sunday=6
	return t.AddDate(0, 0, -offset)
}

func monthStart(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func completedOnly(records []FileRecord) []FileRecord {
	out := make([]FileRecord, 0, len(records))
	for _, r := range records {
		if r.Status == "success" {
			out = append(out, r)
		}
	}
	return out
}

// WeeklyTrend aggregates completed training distance by Monday-starting week for the last
// `weeks` weeks (including the current week), zero-filling weeks without any training.
func WeeklyTrend(records []FileRecord, weeks int, now time.Time) []WeeklyTrendPoint {
	if weeks <= 0 {
		weeks = 12
	}
	currentWeek := mondayStart(now.UTC())
	buckets := make(map[string]*WeeklyTrendPoint, weeks)
	order := make([]string, 0, weeks)
	for i := weeks - 1; i >= 0; i-- {
		ws := currentWeek.AddDate(0, 0, -7*i)
		key := ws.Format("2006-01-02")
		buckets[key] = &WeeklyTrendPoint{WeekStart: key, IsCurrent: i == 0}
		order = append(order, key)
	}

	earliest := currentWeek.AddDate(0, 0, -7*(weeks-1))
	for _, rec := range completedOnly(records) {
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		ws := mondayStart(date)
		if ws.Before(earliest) || ws.After(currentWeek) {
			continue
		}
		key := ws.Format("2006-01-02")
		if bucket, exists := buckets[key]; exists {
			bucket.DistanceMeters += rec.DistanceMeters
			bucket.SessionCount++
		}
	}

	result := make([]WeeklyTrendPoint, 0, len(order))
	for _, key := range order {
		result = append(result, *buckets[key])
	}
	return result
}

// MonthlyTrend aggregates completed training distance by calendar month for the last
// `months` months (including the current month), zero-filling months without training.
func MonthlyTrend(records []FileRecord, months int, now time.Time) []MonthlyTrendPoint {
	if months <= 0 {
		months = 12
	}
	currentMonth := monthStart(now.UTC())
	buckets := make(map[string]*MonthlyTrendPoint, months)
	order := make([]string, 0, months)
	for i := months - 1; i >= 0; i-- {
		m := currentMonth.AddDate(0, -i, 0)
		key := m.Format("2006-01")
		buckets[key] = &MonthlyTrendPoint{Month: key, IsCurrent: i == 0}
		order = append(order, key)
	}

	earliest := currentMonth.AddDate(0, -(months - 1), 0)
	for _, rec := range completedOnly(records) {
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		ms := monthStart(date)
		if ms.Before(earliest) || ms.After(currentMonth) {
			continue
		}
		key := ms.Format("2006-01")
		if bucket, exists := buckets[key]; exists {
			bucket.DistanceMeters += rec.DistanceMeters
			bucket.SessionCount++
		}
	}

	result := make([]MonthlyTrendPoint, 0, len(order))
	for _, key := range order {
		result = append(result, *buckets[key])
	}
	return result
}

// PaceTrend computes a distance-weighted average pace (seconds per km) per week, omitting
// weeks that have no activity with reliable distance/duration data rather than showing a
// misleading zero or interpolated value.
func PaceTrend(records []FileRecord, weeks int, now time.Time) []PaceTrendPoint {
	if weeks <= 0 {
		weeks = 12
	}
	currentWeek := mondayStart(now.UTC())
	earliest := currentWeek.AddDate(0, 0, -7*(weeks-1))

	type accum struct {
		distance float64
		duration float64
	}
	buckets := make(map[string]*accum)

	for _, rec := range completedOnly(records) {
		if rec.DistanceMeters < 50 || rec.DurationSeconds <= 0 {
			continue
		}
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		ws := mondayStart(date)
		if ws.Before(earliest) || ws.After(currentWeek) {
			continue
		}
		key := ws.Format("2006-01-02")
		bucket, exists := buckets[key]
		if !exists {
			bucket = &accum{}
			buckets[key] = bucket
		}
		bucket.distance += rec.DistanceMeters
		bucket.duration += rec.DurationSeconds
	}

	keys := make([]string, 0, len(buckets))
	for key := range buckets {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := make([]PaceTrendPoint, 0, len(keys))
	for _, key := range keys {
		bucket := buckets[key]
		if bucket.distance <= 0 {
			continue
		}
		km := bucket.distance / 1000
		result = append(result, PaceTrendPoint{
			WeekStart:       key,
			AvgPaceSecPerKm: bucket.duration / km,
			DistanceMeters:  bucket.distance,
			IsCurrent:       key == currentWeek.Format("2006-01-02"),
		})
	}
	return result
}

// HeartRateTrend computes average heart rate per week, only for weeks where at least one
// completed activity has heart-rate data. Weeks without heart-rate data are omitted.
func HeartRateTrend(records []FileRecord, weeks int, now time.Time) []HeartRateTrendPoint {
	if weeks <= 0 {
		weeks = 12
	}
	currentWeek := mondayStart(now.UTC())
	earliest := currentWeek.AddDate(0, 0, -7*(weeks-1))

	type accum struct {
		hrSum    float64
		hrCount  int
		distance float64
	}
	buckets := make(map[string]*accum)

	for _, rec := range completedOnly(records) {
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		ws := mondayStart(date)
		if ws.Before(earliest) || ws.After(currentWeek) {
			continue
		}
		key := ws.Format("2006-01-02")
		bucket, exists := buckets[key]
		if !exists {
			bucket = &accum{}
			buckets[key] = bucket
		}
		bucket.distance += rec.DistanceMeters
		if rec.AvgHeartRate > 0 {
			bucket.hrSum += rec.AvgHeartRate
			bucket.hrCount++
		}
	}

	keys := make([]string, 0, len(buckets))
	for key := range buckets {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := make([]HeartRateTrendPoint, 0, len(keys))
	for _, key := range keys {
		bucket := buckets[key]
		if bucket.hrCount == 0 {
			continue
		}
		result = append(result, HeartRateTrendPoint{
			WeekStart:      key,
			AvgHeartRate:   bucket.hrSum / float64(bucket.hrCount),
			DistanceMeters: bucket.distance,
			IsCurrent:      key == currentWeek.Format("2006-01-02"),
		})
	}
	return result
}

// PersonalBests identifies the fastest completed time recorded for each well-known distance.
// A record only qualifies when its distance is at or slightly above the target distance
// (never below), since a shorter run cannot honestly represent that distance.
func PersonalBests(records []FileRecord) []PersonalBest {
	bests := make([]PersonalBest, 0, len(personalBestDistances))
	for _, target := range personalBestDistances {
		var best *PersonalBest
		for _, rec := range completedOnly(records) {
			if rec.DurationSeconds <= 0 || rec.DistanceMeters < target.Meters {
				continue
			}
			if rec.DistanceMeters > target.Meters*personalBestToleranceRatio {
				continue
			}
			if best == nil || rec.DurationSeconds < best.BestSeconds {
				best = &PersonalBest{
					Label:          target.Label,
					DistanceMeters: target.Meters,
					BestSeconds:    rec.DurationSeconds,
					Date:           rec.ActivityDate,
					ActivityID:     rec.ID,
					ActivityName:   rec.Name,
				}
			}
		}
		if best != nil {
			bests = append(bests, *best)
		}
	}
	return bests
}

// CurrentWeekDistance sums completed training distance within the current Monday-starting week.
func CurrentWeekDistance(records []FileRecord, now time.Time) (float64, int) {
	week := mondayStart(now.UTC())
	weekEnd := week.AddDate(0, 0, 7)
	var distance float64
	var count int
	for _, rec := range completedOnly(records) {
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		if !date.Before(week) && date.Before(weekEnd) {
			distance += rec.DistanceMeters
			count++
		}
	}
	return distance, count
}

// CurrentMonthDistance sums completed training distance within the current calendar month.
func CurrentMonthDistance(records []FileRecord, now time.Time) (float64, int) {
	month := monthStart(now.UTC())
	monthEnd := month.AddDate(0, 1, 0)
	var distance float64
	var count int
	for _, rec := range completedOnly(records) {
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		if !date.Before(month) && date.Before(monthEnd) {
			distance += rec.DistanceMeters
			count++
		}
	}
	return distance, count
}

// round2 avoids showing spurious floating-point precision in API responses.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
