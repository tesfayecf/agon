package activities

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"time"
)

// Workout types a training can be marked as. The empty string means "not set".
const (
	WorkoutTypeEasy      = "easy"
	WorkoutTypeLong      = "long"
	WorkoutTypeTempo     = "tempo"
	WorkoutTypeHills     = "hills" // runs with a lot of climbing
	WorkoutTypeIntervals = "intervals"
	WorkoutTypeRace      = "race"
	WorkoutTypeOther     = "other"
)

// Interval segment kinds.
const (
	IntervalKindWarmup   = "warmup"
	IntervalKindWork     = "work"
	IntervalKindRecovery = "recovery"
	IntervalKindCooldown = "cooldown"
)

// Interval bases: whether Start and Length are seconds or meters.
const (
	IntervalBasisTime     = "time"
	IntervalBasisDistance = "distance"
)

// ErrInvalidWorkout wraps every validation failure so callers can map it to a 4xx.
var ErrInvalidWorkout = errors.New("invalid workout")

var validWorkoutTypes = map[string]bool{
	"":                   true,
	WorkoutTypeEasy:      true,
	WorkoutTypeLong:      true,
	WorkoutTypeTempo:     true,
	WorkoutTypeHills:     true,
	WorkoutTypeIntervals: true,
	WorkoutTypeRace:      true,
	WorkoutTypeOther:     true,
}

var validIntervalKinds = map[string]bool{
	IntervalKindWarmup:   true,
	IntervalKindWork:     true,
	IntervalKindRecovery: true,
	IntervalKindCooldown: true,
}

// Interval is one user-specified segment of an interval training.
//
// Basis, Start and Length are the user's input: with basis "time" they are
// seconds from the start of the activity and a duration in seconds; with basis
// "distance" they are meters from the start and a length in meters. Every other
// field is derived from the activity's pace and heart-rate profile by
// ResolveIntervals and is overwritten on each save.
type Interval struct {
	Kind   string  `json:"kind"`
	Label  string  `json:"label,omitempty"`
	Basis  string  `json:"basis"`
	Start  float64 `json:"start"`
	Length float64 `json:"length"`

	StartSeconds        float64 `json:"startSeconds"`
	EndSeconds          float64 `json:"endSeconds"`
	DurationSeconds     float64 `json:"durationSeconds"`
	StartMeters         float64 `json:"startMeters"`
	EndMeters           float64 `json:"endMeters"`
	DistanceMeters      float64 `json:"distanceMeters"`
	AvgPaceSecondsPerKm float64 `json:"avgPaceSecondsPerKm"`
	AvgHeartRate        float64 `json:"avgHeartRate"`
	MaxHeartRate        float64 `json:"maxHeartRate"`
}

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidWorkout, fmt.Sprintf(format, args...))
}

// ValidateWorkout checks a workout type and the shape of its intervals and
// defaults an empty basis to "time". Intervals are only allowed on interval workouts.
func ValidateWorkout(workoutType string, intervals []Interval) ([]Interval, error) {
	if !validWorkoutTypes[workoutType] {
		return nil, invalid("workoutType %q (use easy, long, tempo, hills, intervals, race, other or empty)", workoutType)
	}
	if workoutType != WorkoutTypeIntervals {
		if len(intervals) > 0 {
			return nil, invalid("intervals can only be set when workoutType is %q", WorkoutTypeIntervals)
		}
		return []Interval{}, nil
	}

	out := make([]Interval, len(intervals))
	copy(out, intervals)
	for i := range out {
		iv := &out[i]
		if iv.Basis == "" {
			iv.Basis = IntervalBasisTime
		}
		if !validIntervalKinds[iv.Kind] {
			return nil, invalid("interval %d: kind %q (use warmup, work, recovery or cooldown)", i+1, iv.Kind)
		}
		if iv.Basis != IntervalBasisTime && iv.Basis != IntervalBasisDistance {
			return nil, invalid("interval %d: basis %q (use time or distance)", i+1, iv.Basis)
		}
		if iv.Start < 0 || iv.Length <= 0 || math.IsNaN(iv.Start) || math.IsNaN(iv.Length) || math.IsInf(iv.Start+iv.Length, 0) {
			return nil, invalid("interval %d: start must be >= 0 and length > 0", i+1)
		}
	}
	return out, nil
}

// timeSeries is a per-second resampling of an activity's records, with elapsed
// time measured from the first record. cum[i] is the distance covered before
// second i, so len(cum) == len(speed)+1.
type timeSeries struct {
	speed []float64 // m/s, forward-filled
	hr    []float64 // bpm, forward-filled, 0 when unknown
	cum   []float64 // meters
}

const maxPlausibleSpeed = 10.0 // m/s; anything faster is a GPS glitch

func buildTimeSeries(records []ActivityRecord) timeSeries {
	type sample struct {
		t   int
		rec ActivityRecord
	}
	samples := make([]sample, 0, len(records))
	var t0 time.Time
	for _, r := range records {
		ts, err := time.Parse(time.RFC3339, r.Timestamp)
		if err != nil {
			continue
		}
		if t0.IsZero() {
			t0 = ts
		}
		samples = append(samples, sample{t: int(ts.Sub(t0).Seconds()), rec: r})
	}
	if len(samples) == 0 {
		return timeSeries{}
	}
	n := samples[len(samples)-1].t + 1
	if n <= 1 || n > 7*24*3600 {
		return timeSeries{}
	}

	speed := make([]float64, n)
	hr := make([]float64, n)
	speedSet := make([]bool, n)
	hrSet := make([]bool, n)
	var lastDist *float64
	lastDistT := 0
	for _, s := range samples {
		if s.t < 0 || s.t >= n {
			continue
		}
		var v *float64
		if s.rec.Speed != nil {
			v = s.rec.Speed
		} else if s.rec.Distance != nil && lastDist != nil && s.t > lastDistT {
			d := (*s.rec.Distance - *lastDist) / float64(s.t-lastDistT)
			v = &d
		}
		if s.rec.Distance != nil {
			lastDist = s.rec.Distance
			lastDistT = s.t
		}
		if v != nil && *v >= 0 && *v <= maxPlausibleSpeed {
			speed[s.t] = *v
			speedSet[s.t] = true
		}
		if s.rec.HeartRate != nil && *s.rec.HeartRate > 0 {
			hr[s.t] = *s.rec.HeartRate
			hrSet[s.t] = true
		}
	}
	for i := 1; i < n; i++ {
		if !speedSet[i] {
			speed[i] = speed[i-1]
		}
		if !hrSet[i] {
			hr[i] = hr[i-1]
		}
	}
	cum := make([]float64, n+1)
	for i, v := range speed {
		cum[i+1] = cum[i] + v
	}
	return timeSeries{speed: speed, hr: hr, cum: cum}
}

func (ts timeSeries) empty() bool { return len(ts.speed) == 0 }

func (ts timeSeries) duration() float64 { return float64(len(ts.speed)) }

func (ts timeSeries) total() float64 { return ts.cum[len(ts.cum)-1] }

// distanceAt returns the meters covered after t elapsed seconds.
func (ts timeSeries) distanceAt(t float64) float64 {
	if t <= 0 {
		return 0
	}
	if t >= ts.duration() {
		return ts.total()
	}
	i := int(math.Floor(t))
	return ts.cum[i] + (ts.cum[i+1]-ts.cum[i])*(t-float64(i))
}

// timeAt returns the elapsed seconds at which d meters have been covered.
func (ts timeSeries) timeAt(d float64) float64 {
	if d <= 0 {
		return 0
	}
	if d >= ts.total() {
		return ts.duration()
	}
	i := sort.Search(len(ts.cum), func(k int) bool { return ts.cum[k] >= d })
	// cum[i-1] < d <= cum[i]
	span := ts.cum[i] - ts.cum[i-1]
	if span <= 0 {
		return float64(i)
	}
	return float64(i-1) + (d-ts.cum[i-1])/span
}

// ResolveIntervals computes every derived field of the intervals from the
// activity records and returns them sorted by start time. Intervals that run
// past the end of the activity are clamped to it. Without usable track data,
// time-based intervals keep their duration but have no stats, and
// distance-based intervals cannot be resolved.
func ResolveIntervals(records []ActivityRecord, intervals []Interval) ([]Interval, error) {
	ts := buildTimeSeries(records)
	out := make([]Interval, len(intervals))
	for i, iv := range intervals {
		n := i + 1
		var s, e float64
		switch iv.Basis {
		case IntervalBasisDistance:
			if ts.empty() {
				return nil, invalid("interval %d: distance-based intervals need the activity's track data", n)
			}
			if iv.Start >= ts.total() {
				return nil, invalid("interval %d starts at %.0f m, after the end of the activity (%.0f m)", n, iv.Start, ts.total())
			}
			s, e = ts.timeAt(iv.Start), ts.timeAt(iv.Start+iv.Length)
		default:
			s, e = iv.Start, iv.Start+iv.Length
			if !ts.empty() {
				if s >= ts.duration() {
					return nil, invalid("interval %d starts at %.0f s, after the end of the activity (%.0f s)", n, s, ts.duration())
				}
				e = math.Min(e, ts.duration())
			}
		}

		iv.StartSeconds, iv.EndSeconds, iv.DurationSeconds = s, e, e-s
		iv.StartMeters, iv.EndMeters, iv.DistanceMeters = 0, 0, 0
		iv.AvgPaceSecondsPerKm, iv.AvgHeartRate, iv.MaxHeartRate = 0, 0, 0
		if !ts.empty() {
			iv.StartMeters, iv.EndMeters = ts.distanceAt(s), ts.distanceAt(e)
			iv.DistanceMeters = iv.EndMeters - iv.StartMeters
			if iv.DistanceMeters > 0 {
				iv.AvgPaceSecondsPerKm = iv.DurationSeconds / iv.DistanceMeters * 1000
			}
			var hrSum, hrMax float64
			var hrCount int
			for t := int(math.Floor(s)); t < int(math.Ceil(e)) && t < len(ts.hr); t++ {
				if h := ts.hr[t]; h > 0 {
					hrSum += h
					hrCount++
					hrMax = math.Max(hrMax, h)
				}
			}
			if hrCount > 0 {
				iv.AvgHeartRate = hrSum / float64(hrCount)
				iv.MaxHeartRate = hrMax
			}
		}
		out[i] = roundInterval(iv)
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].StartSeconds < out[j].StartSeconds })
	for i := 1; i < len(out); i++ {
		if out[i].StartSeconds < out[i-1].EndSeconds-1e-6 {
			return nil, invalid("intervals overlap: one ending at %.0f s starts before the previous one ends", out[i].StartSeconds)
		}
	}
	return out, nil
}

func roundInterval(iv Interval) Interval {
	r := func(v float64, places float64) float64 {
		p := math.Pow(10, places)
		return math.Round(v*p) / p
	}
	iv.StartSeconds, iv.EndSeconds, iv.DurationSeconds = r(iv.StartSeconds, 1), r(iv.EndSeconds, 1), r(iv.DurationSeconds, 1)
	iv.StartMeters, iv.EndMeters, iv.DistanceMeters = r(iv.StartMeters, 1), r(iv.EndMeters, 1), r(iv.DistanceMeters, 1)
	iv.AvgPaceSecondsPerKm, iv.AvgHeartRate = r(iv.AvgPaceSecondsPerKm, 1), r(iv.AvgHeartRate, 1)
	return iv
}
