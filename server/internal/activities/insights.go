package activities

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// Dashboard insights split the trainings in two families: interval sessions
// (workout type "intervals") and every other run, which is analysed as
// continuous, endurance-style running.

func isIntervalSession(rec FileRecord) bool {
	return rec.WorkoutType == WorkoutTypeIntervals
}

// ---------------------------------------------------------------------------
// Endurance runs
// ---------------------------------------------------------------------------

// EnduranceWeekPoint is the continuous-run volume of one Monday-starting week.
type EnduranceWeekPoint struct {
	WeekStart      string  `json:"weekStart"`
	DistanceMeters float64 `json:"distanceMeters"`
	LongestMeters  float64 `json:"longestMeters"`
	RunCount       int     `json:"runCount"`
	IsCurrent      bool    `json:"isCurrent"`
}

// RunSummary identifies a single run.
type RunSummary struct {
	ActivityID      string  `json:"activityId"`
	ActivityName    string  `json:"activityName"`
	Date            string  `json:"date"`
	DistanceMeters  float64 `json:"distanceMeters"`
	DurationSeconds float64 `json:"durationSeconds"`
	AvgHeartRate    float64 `json:"avgHeartRate"`
}

// DistanceBand counts runs whose distance falls in [MinMeters, MaxMeters).
// MaxMeters is 0 for the open-ended last band.
type DistanceBand struct {
	Label     string  `json:"label"`
	MinMeters float64 `json:"minMeters"`
	MaxMeters float64 `json:"maxMeters"`
	Count     int     `json:"count"`
}

var enduranceDistanceBands = []DistanceBand{
	{Label: "< 5 km", MinMeters: 0, MaxMeters: 5000},
	{Label: "5–8 km", MinMeters: 5000, MaxMeters: 8000},
	{Label: "8–12 km", MinMeters: 8000, MaxMeters: 12000},
	{Label: "12–16 km", MinMeters: 12000, MaxMeters: 16000},
	{Label: "16–21 km", MinMeters: 16000, MaxMeters: 21000},
	{Label: "21 km +", MinMeters: 21000},
}

// EnduranceAnalytics summarises every completed run that is not an interval
// session. Totals and the weekly series cover the last WindowWeeks weeks; the
// efficiency points and distance bands cover all history.
type EnduranceAnalytics struct {
	WindowWeeks          int                  `json:"windowWeeks"`
	RunCount             int                  `json:"runCount"`
	TotalDistanceMeters  float64              `json:"totalDistanceMeters"`
	TotalDurationSeconds float64              `json:"totalDurationSeconds"`
	ElevationGainMeters  float64              `json:"elevationGainMeters"`
	AvgDistanceMeters    float64              `json:"avgDistanceMeters"`
	AvgPaceSecPerKm      float64              `json:"avgPaceSecondsPerKm"`
	AvgHeartRate         float64              `json:"avgHeartRate"`
	LongestRun           *RunSummary          `json:"longestRun"`
	Weekly               []EnduranceWeekPoint `json:"weekly"`
	EfficiencyPoints     []PaceHeartRatePoint `json:"efficiencyPoints"`
	DistanceBands        []DistanceBand       `json:"distanceBands"`
}

func runSummary(rec FileRecord) RunSummary {
	return RunSummary{
		ActivityID:      rec.ID,
		ActivityName:    rec.Name,
		Date:            rec.ActivityDate,
		DistanceMeters:  rec.DistanceMeters,
		DurationSeconds: rec.DurationSeconds,
		AvgHeartRate:    round2(rec.AvgHeartRate),
	}
}

// ComputeEnduranceAnalytics aggregates the non-interval runs as of `now`.
func ComputeEnduranceAnalytics(records []FileRecord, weeks int, now time.Time) EnduranceAnalytics {
	if weeks <= 0 {
		weeks = 12
	}
	type datedRun struct {
		rec  FileRecord
		when time.Time
	}
	runs := make([]datedRun, 0, len(records))
	for _, rec := range completedOnly(records) {
		if isIntervalSession(rec) {
			continue
		}
		when, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		runs = append(runs, datedRun{rec: rec, when: when})
	}
	sort.Slice(runs, func(i, j int) bool { return runs[i].when.Before(runs[j].when) })

	currentWeek := mondayStart(now.UTC())
	earliest := currentWeek.AddDate(0, 0, -7*(weeks-1))
	weekEnd := currentWeek.AddDate(0, 0, 7)

	out := EnduranceAnalytics{WindowWeeks: weeks}
	weekly := make([]EnduranceWeekPoint, weeks)
	for i := range weekly {
		ws := earliest.AddDate(0, 0, 7*i)
		weekly[i] = EnduranceWeekPoint{WeekStart: ws.Format("2006-01-02"), IsCurrent: i == weeks-1}
	}

	var paceDistance, paceDuration, hrSum float64
	var hrCount int
	bands := append([]DistanceBand(nil), enduranceDistanceBands...)
	filtered := make([]FileRecord, 0, len(runs))

	for _, run := range runs {
		rec := run.rec
		filtered = append(filtered, rec)
		for i := range bands {
			if rec.DistanceMeters >= bands[i].MinMeters && (bands[i].MaxMeters == 0 || rec.DistanceMeters < bands[i].MaxMeters) {
				bands[i].Count++
				break
			}
		}

		if run.when.Before(earliest) || !run.when.Before(weekEnd) {
			continue
		}
		out.RunCount++
		out.TotalDistanceMeters += rec.DistanceMeters
		out.TotalDurationSeconds += rec.DurationSeconds
		out.ElevationGainMeters += rec.ElevationGain
		if rec.DistanceMeters >= minScatterDistanceMeters && rec.DurationSeconds > 0 {
			paceDistance += rec.DistanceMeters
			paceDuration += rec.DurationSeconds
		}
		if rec.AvgHeartRate > 0 {
			hrSum += rec.AvgHeartRate
			hrCount++
		}
		if out.LongestRun == nil || rec.DistanceMeters > out.LongestRun.DistanceMeters {
			s := runSummary(rec)
			out.LongestRun = &s
		}
		idx := int(mondayStart(run.when).Sub(earliest).Hours() / (24 * 7))
		if idx >= 0 && idx < weeks {
			w := &weekly[idx]
			w.DistanceMeters += rec.DistanceMeters
			w.RunCount++
			w.LongestMeters = math.Max(w.LongestMeters, rec.DistanceMeters)
		}
	}

	if out.RunCount > 0 {
		out.AvgDistanceMeters = round2(out.TotalDistanceMeters / float64(out.RunCount))
	}
	if paceDistance > 0 {
		out.AvgPaceSecPerKm = round2(paceDuration / (paceDistance / 1000))
	}
	if hrCount > 0 {
		out.AvgHeartRate = round2(hrSum / float64(hrCount))
	}
	out.TotalDistanceMeters = round2(out.TotalDistanceMeters)
	out.ElevationGainMeters = round2(out.ElevationGainMeters)
	out.Weekly = weekly
	out.EfficiencyPoints = PaceHeartRateSeries(filtered)
	out.DistanceBands = bands
	return out
}

// ---------------------------------------------------------------------------
// Interval sessions
// ---------------------------------------------------------------------------

// IntervalRep is one work segment of an interval session.
type IntervalRep struct {
	Label           string  `json:"label,omitempty"`
	Basis           string  `json:"basis"`
	DurationSeconds float64 `json:"durationSeconds"`
	DistanceMeters  float64 `json:"distanceMeters"`
	AvgPaceSecPerKm float64 `json:"avgPaceSecondsPerKm"`
	AvgHeartRate    float64 `json:"avgHeartRate"`
	MaxHeartRate    float64 `json:"maxHeartRate"`
	// Plausible is false when the rep's pace looks like a GPS glitch; such reps
	// still count as work time but are left out of every pace figure.
	Plausible bool `json:"plausible"`
}

// SessionSegment is one labelled segment of an interval session, in order.
type SessionSegment struct {
	Kind            string  `json:"kind"`
	StartSeconds    float64 `json:"startSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	AvgPaceSecPerKm float64 `json:"avgPaceSecondsPerKm"`
	AvgHeartRate    float64 `json:"avgHeartRate"`
}

// IntervalSession summarises one labelled interval training.
type IntervalSession struct {
	ActivityID      string  `json:"activityId"`
	ActivityName    string  `json:"activityName"`
	Date            string  `json:"date"`
	DurationSeconds float64 `json:"durationSeconds"`
	// Structure is a compact description of the work reps, e.g. "5 × 2:00" or
	// "1:00 · 3:00 · 5:00 · 3:00 · 1:00".
	Structure        string  `json:"structure"`
	RepCount         int     `json:"repCount"`
	WorkSeconds      float64 `json:"workSeconds"`
	WorkMeters       float64 `json:"workMeters"`
	RecoverySeconds  float64 `json:"recoverySeconds"`
	AvgWorkPace      float64 `json:"avgWorkPaceSecondsPerKm"`
	AvgWorkHeartRate float64 `json:"avgWorkHeartRate"`
	// WorkMetersPerBeat is the distance covered per heartbeat during the reps:
	// higher means more speed for the same cardiac effort.
	WorkMetersPerBeat float64 `json:"workMetersPerBeat"`
	// FadePercent compares the last rep of the session's most common length to
	// the first one: positive means the last was slower. Nil when there are not
	// two comparable reps.
	FadePercent *float64         `json:"fadePercent"`
	Reps        []IntervalRep    `json:"reps"`
	Segments    []SessionSegment `json:"segments"`
}

// RepPacePoint is the average pace of one session's reps of a given length.
type RepPacePoint struct {
	Date            string  `json:"date"`
	ActivityID      string  `json:"activityId"`
	ActivityName    string  `json:"activityName"`
	AvgPaceSecPerKm float64 `json:"avgPaceSecondsPerKm"`
	AvgHeartRate    float64 `json:"avgHeartRate"`
	Reps            int     `json:"reps"`
}

// RepDurationSeries tracks the pace of reps of one standard length over time.
type RepDurationSeries struct {
	DurationSeconds int            `json:"durationSeconds"`
	Label           string         `json:"label"`
	SessionCount    int            `json:"sessionCount"`
	Points          []RepPacePoint `json:"points"`
}

// QualityWeekPoint is the time spent in work reps in one week, next to the
// total training time of that week.
type QualityWeekPoint struct {
	WeekStart            string  `json:"weekStart"`
	WorkSeconds          float64 `json:"workSeconds"`
	WorkMeters           float64 `json:"workMeters"`
	TotalSeconds         float64 `json:"totalSeconds"`
	IntervalSessionCount int     `json:"intervalSessionCount"`
	IsCurrent            bool    `json:"isCurrent"`
}

// IntervalAnalytics summarises the labelled interval sessions. Counters and
// the weekly series cover the last WindowWeeks weeks; Sessions and
// RepProgression cover all history (chronological).
type IntervalAnalytics struct {
	WindowWeeks      int                 `json:"windowWeeks"`
	SessionCount     int                 `json:"sessionCount"`
	RepCount         int                 `json:"repCount"`
	WorkSeconds      float64             `json:"workSeconds"`
	WorkMeters       float64             `json:"workMeters"`
	WorkShare        float64             `json:"workShare"` // work time / all training time in the window, 0..1
	AvgWorkRestRatio float64             `json:"avgWorkRestRatio"`
	UnlabelledCount  int                 `json:"unlabelledCount"`
	Sessions         []IntervalSession   `json:"sessions"`
	RepProgression   []RepDurationSeries `json:"repProgression"`
	WeeklyQuality    []QualityWeekPoint  `json:"weeklyQuality"`
}

const (
	// repDurationBucketSeconds groups time-based reps by length; a rep entered as
	// 64 s still lands in the 1:00 bucket.
	repDurationBucketSeconds = 15
	// minPlausibleRepPace (2:30 /km) and maxRepSpeedupOverMedian catch GPS
	// glitches: a rep that is impossibly fast, or much faster than the other
	// reps of its session, is not trusted for pace.
	minPlausibleRepPace     = 150.0
	maxRepSpeedupOverMedian = 0.35
)

func formatClockSeconds(seconds float64) string {
	total := int(math.Round(seconds))
	if total >= 3600 {
		return fmt.Sprintf("%d:%02d:%02d", total/3600, (total%3600)/60, total%60)
	}
	return fmt.Sprintf("%d:%02d", total/60, total%60)
}

func repBucket(rep IntervalRep) int {
	if rep.Basis != IntervalBasisTime {
		return 0
	}
	return int(math.Round(rep.DurationSeconds/repDurationBucketSeconds)) * repDurationBucketSeconds
}

func median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	s := append([]float64(nil), values...)
	sort.Float64s(s)
	mid := len(s) / 2
	if len(s)%2 == 0 {
		return (s[mid-1] + s[mid]) / 2
	}
	return s[mid]
}

// describeStructure run-length encodes consecutive reps of equal length.
func describeStructure(reps []IntervalRep) string {
	parts := []string{}
	for i := 0; i < len(reps); {
		label := repLengthLabel(reps[i])
		j := i
		for j < len(reps) && repLengthLabel(reps[j]) == label {
			j++
		}
		if n := j - i; n > 1 {
			parts = append(parts, fmt.Sprintf("%d × %s", n, label))
		} else {
			parts = append(parts, label)
		}
		i = j
	}
	return strings.Join(parts, " · ")
}

func repLengthLabel(rep IntervalRep) string {
	if rep.Basis == IntervalBasisDistance {
		return fmt.Sprintf("%.0f m", math.Round(rep.DistanceMeters/10)*10)
	}
	if b := repBucket(rep); b > 0 {
		return formatClockSeconds(float64(b))
	}
	return formatClockSeconds(rep.DurationSeconds)
}

func buildIntervalSession(rec FileRecord) (IntervalSession, bool) {
	segments := append([]Interval(nil), rec.Intervals...)
	sort.SliceStable(segments, func(i, j int) bool { return segments[i].StartSeconds < segments[j].StartSeconds })

	s := IntervalSession{
		ActivityID:      rec.ID,
		ActivityName:    rec.Name,
		Date:            rec.ActivityDate,
		DurationSeconds: rec.DurationSeconds,
		Reps:            []IntervalRep{},
		Segments:        make([]SessionSegment, 0, len(segments)),
	}
	paces := []float64{}
	for _, iv := range segments {
		if iv.DurationSeconds <= 0 {
			continue
		}
		s.Segments = append(s.Segments, SessionSegment{
			Kind:            iv.Kind,
			StartSeconds:    iv.StartSeconds,
			DurationSeconds: iv.DurationSeconds,
			AvgPaceSecPerKm: iv.AvgPaceSecondsPerKm,
			AvgHeartRate:    iv.AvgHeartRate,
		})
		switch iv.Kind {
		case IntervalKindWork:
			s.Reps = append(s.Reps, IntervalRep{
				Label:           iv.Label,
				Basis:           iv.Basis,
				DurationSeconds: iv.DurationSeconds,
				DistanceMeters:  iv.DistanceMeters,
				AvgPaceSecPerKm: iv.AvgPaceSecondsPerKm,
				AvgHeartRate:    iv.AvgHeartRate,
				MaxHeartRate:    iv.MaxHeartRate,
			})
			if iv.AvgPaceSecondsPerKm > 0 {
				paces = append(paces, iv.AvgPaceSecondsPerKm)
			}
		case IntervalKindRecovery:
			s.RecoverySeconds += iv.DurationSeconds
		}
	}
	if len(s.Reps) == 0 {
		return s, false
	}

	med := median(paces)
	var paceMeters, paceSeconds, hrWeighted, hrSeconds float64
	for i := range s.Reps {
		r := &s.Reps[i]
		r.Plausible = r.AvgPaceSecPerKm >= minPlausibleRepPace && (med == 0 || r.AvgPaceSecPerKm >= med*(1-maxRepSpeedupOverMedian))
		s.WorkSeconds += r.DurationSeconds
		s.WorkMeters += r.DistanceMeters
		if r.Plausible {
			paceMeters += r.DistanceMeters
			paceSeconds += r.DurationSeconds
		}
		if r.AvgHeartRate > 0 {
			hrWeighted += r.AvgHeartRate * r.DurationSeconds
			hrSeconds += r.DurationSeconds
		}
	}
	s.RepCount = len(s.Reps)
	s.Structure = describeStructure(s.Reps)
	if paceMeters > 0 {
		s.AvgWorkPace = round2(paceSeconds / paceMeters * 1000)
	}
	if hrSeconds > 0 {
		s.AvgWorkHeartRate = round2(hrWeighted / hrSeconds)
	}
	if paceSeconds > 0 && s.AvgWorkHeartRate > 0 {
		s.WorkMetersPerBeat = round2(paceMeters / (paceSeconds / 60) / s.AvgWorkHeartRate)
	}
	s.FadePercent = sessionFade(s.Reps)
	s.WorkSeconds = round2(s.WorkSeconds)
	s.WorkMeters = round2(s.WorkMeters)
	s.RecoverySeconds = round2(s.RecoverySeconds)
	return s, true
}

// sessionFade compares the last with the first plausible rep of the session's
// most common time-based length (ties go to the longer length).
func sessionFade(reps []IntervalRep) *float64 {
	counts := map[int]int{}
	for _, r := range reps {
		if b := repBucket(r); b > 0 && r.Plausible {
			counts[b]++
		}
	}
	best, bestCount := 0, 0
	for b, n := range counts {
		if n > bestCount || (n == bestCount && b > best) {
			best, bestCount = b, n
		}
	}
	if bestCount < 2 {
		return nil
	}
	var first, last float64
	for _, r := range reps {
		if repBucket(r) != best || !r.Plausible {
			continue
		}
		if first == 0 {
			first = r.AvgPaceSecPerKm
		}
		last = r.AvgPaceSecPerKm
	}
	if first <= 0 {
		return nil
	}
	fade := round2((last - first) / first * 100)
	return &fade
}

// ComputeIntervalAnalytics aggregates the labelled interval sessions as of `now`.
func ComputeIntervalAnalytics(records []FileRecord, weeks int, now time.Time) IntervalAnalytics {
	if weeks <= 0 {
		weeks = 12
	}
	currentWeek := mondayStart(now.UTC())
	earliest := currentWeek.AddDate(0, 0, -7*(weeks-1))
	weekEnd := currentWeek.AddDate(0, 0, 7)

	out := IntervalAnalytics{WindowWeeks: weeks, Sessions: []IntervalSession{}, RepProgression: []RepDurationSeries{}}
	quality := make([]QualityWeekPoint, weeks)
	for i := range quality {
		ws := earliest.AddDate(0, 0, 7*i)
		quality[i] = QualityWeekPoint{WeekStart: ws.Format("2006-01-02"), IsCurrent: i == weeks-1}
	}
	weekIndex := func(when time.Time) int {
		if when.Before(earliest) || !when.Before(weekEnd) {
			return -1
		}
		return int(mondayStart(when).Sub(earliest).Hours() / (24 * 7))
	}

	type datedSession struct {
		session IntervalSession
		when    time.Time
	}
	sessions := []datedSession{}
	var totalSeconds float64
	for _, rec := range completedOnly(records) {
		when, ok := parseActivityDate(rec.ActivityDate)
		if !ok {
			continue
		}
		idx := weekIndex(when)
		if idx >= 0 {
			quality[idx].TotalSeconds += rec.DurationSeconds
			totalSeconds += rec.DurationSeconds
		}
		if !isIntervalSession(rec) {
			continue
		}
		session, ok := buildIntervalSession(rec)
		if !ok {
			out.UnlabelledCount++
			continue
		}
		sessions = append(sessions, datedSession{session: session, when: when})
	}
	sort.Slice(sessions, func(i, j int) bool { return sessions[i].when.Before(sessions[j].when) })

	type repAccum struct {
		meters, seconds, hrWeighted, hrSeconds float64
		reps                                   int
	}
	progression := map[int][]RepPacePoint{}
	var ratioSum float64
	var ratioCount int
	for _, ds := range sessions {
		s := ds.session
		out.Sessions = append(out.Sessions, s)

		byBucket := map[int]*repAccum{}
		for _, r := range s.Reps {
			b := repBucket(r)
			if b == 0 || !r.Plausible || r.DistanceMeters <= 0 {
				continue
			}
			a := byBucket[b]
			if a == nil {
				a = &repAccum{}
				byBucket[b] = a
			}
			a.meters += r.DistanceMeters
			a.seconds += r.DurationSeconds
			a.reps++
			if r.AvgHeartRate > 0 {
				a.hrWeighted += r.AvgHeartRate * r.DurationSeconds
				a.hrSeconds += r.DurationSeconds
			}
		}
		for b, a := range byBucket {
			p := RepPacePoint{
				Date:            s.Date,
				ActivityID:      s.ActivityID,
				ActivityName:    s.ActivityName,
				AvgPaceSecPerKm: round2(a.seconds / a.meters * 1000),
				Reps:            a.reps,
			}
			if a.hrSeconds > 0 {
				p.AvgHeartRate = round2(a.hrWeighted / a.hrSeconds)
			}
			progression[b] = append(progression[b], p)
		}

		idx := weekIndex(ds.when)
		if idx < 0 {
			continue
		}
		out.SessionCount++
		out.RepCount += s.RepCount
		out.WorkSeconds += s.WorkSeconds
		out.WorkMeters += s.WorkMeters
		quality[idx].WorkSeconds += s.WorkSeconds
		quality[idx].WorkMeters += s.WorkMeters
		quality[idx].IntervalSessionCount++
		if s.RecoverySeconds > 0 {
			ratioSum += s.WorkSeconds / s.RecoverySeconds
			ratioCount++
		}
	}

	buckets := make([]int, 0, len(progression))
	for b := range progression {
		buckets = append(buckets, b)
	}
	sort.Ints(buckets)
	for _, b := range buckets {
		points := progression[b]
		out.RepProgression = append(out.RepProgression, RepDurationSeries{
			DurationSeconds: b,
			Label:           formatClockSeconds(float64(b)),
			SessionCount:    len(points),
			Points:          points,
		})
	}

	for i := range quality {
		quality[i].WorkSeconds = round2(quality[i].WorkSeconds)
		quality[i].WorkMeters = round2(quality[i].WorkMeters)
	}
	out.WeeklyQuality = quality
	out.WorkSeconds = round2(out.WorkSeconds)
	out.WorkMeters = round2(out.WorkMeters)
	if totalSeconds > 0 {
		out.WorkShare = round2(out.WorkSeconds / totalSeconds)
	}
	if ratioCount > 0 {
		out.AvgWorkRestRatio = round2(ratioSum / float64(ratioCount))
	}
	return out
}
