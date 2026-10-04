package activities

import (
	"math"
	"sort"
	"time"
)

// Race prediction uses Jack Daniels' VDOT model (Daniels & Gilbert, "Oxygen Power", 1979):
//
//   - oxygen cost of running at v m/min:       VO2 = −4.60 + 0.182258·v + 0.000104·v²
//   - fraction of VO2max sustainable for t min: %  = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)
//   - VDOT = VO2 / %
//
// Treating an ordinary training run as an all-out effort gives a VDOT that is a lower
// bound on fitness ("best effort" method). When the athlete's resting and maximum heart
// rate are known, the run's average heart rate tells us how hard it actually was: using
// the Swain & Leutholtz (1997) observation that %HRR ≈ %VO2 reserve,
//
//   VO2max ≈ 3.5 + (VO2 − 3.5) / %HRR
//
// which lets submaximal runs contribute ("heart rate" method). Either way the result is an
// estimate for a well-trained, tapered athlete on a flat course, and the UI says so.

const (
	predictorWindowWeeks  = 8
	predictorTrendWeeks   = 12
	predictorMinDistance  = 3000.0
	predictorMinDuration  = 600.0
	predictorMinPace      = 150.0 // 2:30 /km — anything faster is a GPS glitch
	predictorMaxPace      = 720.0 // 12:00 /km — walking, not a usable effort
	predictorMinHRReserve = 0.6   // below this, %HRR → %VO2R extrapolates too far
	// A prediction more than this many times longer than the longest qualifying run is
	// flagged as an extrapolation: VDOT says nothing about endurance you haven't trained.
	predictorExtrapolationRatio = 4.0
)

const (
	PredictionMethodNone       = "none"
	PredictionMethodBestEffort = "best_effort"
	PredictionMethodHeartRate  = "heart_rate"
)

var predictorDistances = []struct {
	Label  string
	Meters float64
}{
	{"5 km", 5000},
	{"10 km", 10000},
	{"Half marathon", 21097.5},
	{"Marathon", 42195},
}

// HeartRateBounds are the athlete's resting and maximum heart rate; zero means unknown.
type HeartRateBounds struct {
	Resting float64
	Max     float64
}

func (b HeartRateBounds) usable() bool {
	return b.Resting > 0 && b.Max > b.Resting
}

// RacePrediction is the predicted finish time for one race distance.
type RacePrediction struct {
	Label               string  `json:"label"`
	DistanceMeters      float64 `json:"distanceMeters"`
	PredictedSeconds    float64 `json:"predictedSeconds"`
	PaceSecondsPerKm    float64 `json:"paceSecondsPerKm"`
	PersonalBestSeconds float64 `json:"personalBestSeconds"`
	IsExtrapolated      bool    `json:"isExtrapolated"`
}

// PredictionBasis is the run that set the best demonstrated effort.
type PredictionBasis struct {
	ActivityID      string  `json:"activityId"`
	ActivityName    string  `json:"activityName"`
	Date            string  `json:"date"`
	DistanceMeters  float64 `json:"distanceMeters"`
	DurationSeconds float64 `json:"durationSeconds"`
	VDOT            float64 `json:"vdot"`
}

// VDOTTrendPoint is the fitness estimate from one week's runs.
type VDOTTrendPoint struct {
	WeekStart string  `json:"weekStart"`
	VDOT      float64 `json:"vdot"`
	RunCount  int     `json:"runCount"`
	IsCurrent bool    `json:"isCurrent"`
}

// RacePredictor is the dashboard's race-prediction payload.
type RacePredictor struct {
	Method              string           `json:"method"`
	VDOT                float64          `json:"vdot"`
	WindowWeeks         int              `json:"windowWeeks"`
	SampleCount         int              `json:"sampleCount"`
	HasHeartRateProfile bool             `json:"hasHeartRateProfile"`
	LongestRunMeters    float64          `json:"longestRunMeters"`
	Basis               *PredictionBasis `json:"basis"`
	Predictions         []RacePrediction `json:"predictions"`
	Trend               []VDOTTrendPoint `json:"trend"`
}

type predictorRun struct {
	rec      FileRecord
	date     time.Time
	raceVDOT float64
	hrVDOT   float64 // 0 when not computable
}

func oxygenCost(metersPerMinute float64) float64 {
	return -4.60 + 0.182258*metersPerMinute + 0.000104*metersPerMinute*metersPerMinute
}

func sustainableFraction(minutes float64) float64 {
	return 0.8 + 0.1894393*math.Exp(-0.012778*minutes) + 0.2989558*math.Exp(-0.1932605*minutes)
}

// VDOTForPerformance returns the VDOT implied by covering meters in seconds at full effort.
func VDOTForPerformance(meters, seconds float64) float64 {
	if meters <= 0 || seconds <= 0 {
		return 0
	}
	minutes := seconds / 60
	return oxygenCost(meters/minutes) / sustainableFraction(minutes)
}

// PredictRaceSeconds solves VDOTForPerformance(meters, t) = vdot for t by bisection.
// VDOT falls monotonically with time over any realistic race duration.
func PredictRaceSeconds(vdot, meters float64) float64 {
	if vdot <= 0 || meters <= 0 {
		return 0
	}
	lo, hi := 60.0, 12*3600.0
	for i := 0; i < 100 && hi-lo > 0.05; i++ {
		mid := (lo + hi) / 2
		if VDOTForPerformance(meters, mid) > vdot {
			lo = mid // still faster than this fitness allows
		} else {
			hi = mid
		}
	}
	return math.Round((lo + hi) / 2)
}

func heartRateVDOT(rec FileRecord, hr HeartRateBounds) float64 {
	if !hr.usable() || rec.AvgHeartRate <= 0 {
		return 0
	}
	reserve := (rec.AvgHeartRate - hr.Resting) / (hr.Max - hr.Resting)
	if reserve < predictorMinHRReserve || reserve > 1 {
		return 0
	}
	cost := oxygenCost(rec.DistanceMeters / (rec.DurationSeconds / 60))
	return 3.5 + (cost-3.5)/reserve
}

func qualifiesForPrediction(rec FileRecord) bool {
	if rec.Status != "success" || rec.WorkoutType == WorkoutTypeIntervals {
		return false
	}
	if rec.DistanceMeters < predictorMinDistance || rec.DurationSeconds < predictorMinDuration {
		return false
	}
	pace := rec.DurationSeconds / (rec.DistanceMeters / 1000)
	return pace >= predictorMinPace && pace <= predictorMaxPace
}

// estimateVDOT aggregates a set of runs into one fitness figure. A demonstrated effort is
// a hard floor; with heart-rate data the median of the effort-adjusted estimates is used
// when it is higher, since the median is robust to a single run with heavy cardiac drift.
func estimateVDOT(runs []predictorRun) (vdot float64, best *predictorRun, method string) {
	if len(runs) == 0 {
		return 0, nil, PredictionMethodNone
	}
	hrEstimates := make([]float64, 0, len(runs))
	for i := range runs {
		if best == nil || runs[i].raceVDOT > best.raceVDOT {
			best = &runs[i]
		}
		if runs[i].hrVDOT > 0 {
			hrEstimates = append(hrEstimates, runs[i].hrVDOT)
		}
	}
	vdot, method = best.raceVDOT, PredictionMethodBestEffort
	if len(hrEstimates) > 0 {
		sort.Float64s(hrEstimates)
		mid := len(hrEstimates) / 2
		median := hrEstimates[mid]
		if len(hrEstimates)%2 == 0 {
			median = (hrEstimates[mid-1] + hrEstimates[mid]) / 2
		}
		if median > vdot {
			vdot, method = median, PredictionMethodHeartRate
		}
	}
	return vdot, best, method
}

// ComputeRacePredictor estimates current race times from the last few weeks of runs.
func ComputeRacePredictor(records []FileRecord, hr HeartRateBounds, now time.Time) RacePredictor {
	currentWeek := mondayStart(now.UTC())
	trendStart := currentWeek.AddDate(0, 0, -7*(predictorTrendWeeks-1))
	windowStart := currentWeek.AddDate(0, 0, -7*(predictorWindowWeeks-1))
	end := currentWeek.AddDate(0, 0, 7)

	result := RacePredictor{
		Method:              PredictionMethodNone,
		WindowWeeks:         predictorWindowWeeks,
		HasHeartRateProfile: hr.usable(),
		Predictions:         []RacePrediction{},
		Trend:               []VDOTTrendPoint{},
	}

	weekly := make(map[string][]predictorRun)
	window := make([]predictorRun, 0)
	for _, rec := range records {
		if !qualifiesForPrediction(rec) {
			continue
		}
		date, ok := parseActivityDate(rec.ActivityDate)
		if !ok || date.Before(trendStart) || !date.Before(end) {
			continue
		}
		run := predictorRun{
			rec:      rec,
			date:     date,
			raceVDOT: VDOTForPerformance(rec.DistanceMeters, rec.DurationSeconds),
			hrVDOT:   heartRateVDOT(rec, hr),
		}
		key := mondayStart(date).Format("2006-01-02")
		weekly[key] = append(weekly[key], run)
		if !date.Before(windowStart) {
			window = append(window, run)
			result.LongestRunMeters = math.Max(result.LongestRunMeters, rec.DistanceMeters)
		}
	}

	keys := make([]string, 0, len(weekly))
	for key := range weekly {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		vdot, _, _ := estimateVDOT(weekly[key])
		result.Trend = append(result.Trend, VDOTTrendPoint{
			WeekStart: key,
			VDOT:      round1(vdot),
			RunCount:  len(weekly[key]),
			IsCurrent: key == currentWeek.Format("2006-01-02"),
		})
	}

	vdot, best, method := estimateVDOT(window)
	if best == nil {
		return result
	}
	result.Method = method
	result.VDOT = round1(vdot)
	result.SampleCount = len(window)
	result.Basis = &PredictionBasis{
		ActivityID:      best.rec.ID,
		ActivityName:    best.rec.Name,
		Date:            best.rec.ActivityDate,
		DistanceMeters:  best.rec.DistanceMeters,
		DurationSeconds: best.rec.DurationSeconds,
		VDOT:            round1(best.raceVDOT),
	}

	pbs := make(map[string]float64)
	for _, pb := range PersonalBests(records) {
		pbs[pb.Label] = pb.BestSeconds
	}
	for _, target := range predictorDistances {
		seconds := PredictRaceSeconds(vdot, target.Meters)
		result.Predictions = append(result.Predictions, RacePrediction{
			Label:               target.Label,
			DistanceMeters:      target.Meters,
			PredictedSeconds:    seconds,
			PaceSecondsPerKm:    round2(seconds / (target.Meters / 1000)),
			PersonalBestSeconds: pbs[target.Label],
			IsExtrapolated:      target.Meters > result.LongestRunMeters*predictorExtrapolationRatio,
		})
	}
	return result
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
