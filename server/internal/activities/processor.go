package activities

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"math"
	"strings"
	"time"

	fit "github.com/tormoder/fit"
)

type ActivityRecord struct {
	Timestamp string   `json:"timestamp,omitempty"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	Distance  *float64 `json:"distance,omitempty"`
	Speed     *float64 `json:"speed,omitempty"`
	HeartRate *float64 `json:"heartRate,omitempty"`
	Altitude  *float64 `json:"altitude,omitempty"`
}

type ActivityFile struct {
	ID              string           `json:"id"`
	Filename        string           `json:"filename"`
	FileType        string           `json:"fileType"`
	ActivityDate    string           `json:"activityDate,omitempty"`
	DurationSeconds float64          `json:"durationSeconds,omitempty"`
	DistanceMeters  float64          `json:"distanceMeters,omitempty"`
	RecordCount     int              `json:"recordCount"`
	Records         []ActivityRecord `json:"records"`
	Status          string           `json:"status"`
	Error           string           `json:"error,omitempty"`
	Name            string           `json:"name"`
	Description     string           `json:"description"`
	Tags            string           `json:"tags"`
	ElevationGain   float64          `json:"elevationGain"`
	AvgHeartRate    float64          `json:"avgHeartRate"`
}

type ActivityUploadResponse struct {
	Files []ActivityFile `json:"files"`
	Error string         `json:"error,omitempty"`
}

func ParseUploadFile(filename string, payload []byte) (ActivityFile, error) {
	lowerName := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(lowerName, ".fit"):
		return parseFITFile(filename, payload)
	case strings.HasSuffix(lowerName, ".tcx"):
		return parseTCXFile(filename, payload)
	default:
		return ActivityFile{Filename: filename, FileType: detectFileType(filename), Status: "error"}, fmt.Errorf("unsupported file type: %s", filename)
	}
}

func parseFITFile(filename string, payload []byte) (ActivityFile, error) {
	decoded, err := fit.Decode(bytes.NewReader(payload))
	if err != nil {
		return ActivityFile{Filename: filename, FileType: "FIT", Status: "error"}, fmt.Errorf("invalid FIT file: %w", err)
	}

	activity, err := decoded.Activity()
	if err != nil {
		return ActivityFile{Filename: filename, FileType: "FIT", Status: "error"}, fmt.Errorf("FIT file does not contain activity data: %w", err)
	}

	result := ActivityFile{
		ID:       fmt.Sprintf("fit-%s", slugify(filename)),
		Filename: filename,
		FileType: "FIT",
		Status:   "success",
	}

	if len(activity.Sessions) > 0 {
		session := activity.Sessions[0]
		result.ActivityDate = formatOptionalTime(session.StartTime)
		result.DurationSeconds = float64(session.TotalElapsedTime)
		result.DistanceMeters = float64(session.TotalDistance)
	}

	if len(activity.Records) > 0 {
		result.Records = make([]ActivityRecord, 0, len(activity.Records))
		for _, record := range activity.Records {
			result.Records = append(result.Records, fitRecordToActivityRecord(*record))
		}
		result.RecordCount = len(result.Records)
		if result.ActivityDate == "" {
			result.ActivityDate = formatOptionalTime(activity.Records[0].Timestamp)
		}
		if result.DurationSeconds == 0 {
			if len(activity.Records) > 1 {
				result.DurationSeconds = activity.Records[len(activity.Records)-1].Timestamp.Sub(activity.Records[0].Timestamp).Seconds()
			}
		}
		if result.DistanceMeters == 0 {
			if last := result.Records[len(result.Records)-1].Distance; last != nil {
				result.DistanceMeters = *last
			}
		}
	}
	finalizeActivityFile(&result, filename)
	return result, nil
}

func parseTCXFile(filename string, payload []byte) (ActivityFile, error) {
	var database struct {
		Activities struct {
			Activity []struct {
				ID  string `xml:"Id"`
				Lap []struct {
					StartTime        string  `xml:"StartTime,attr"`
					TotalTimeSeconds float64 `xml:"TotalTimeSeconds"`
					DistanceMeters   float64 `xml:"DistanceMeters"`
					Track            struct {
						Trackpoint []struct {
							Time     string `xml:"Time"`
							Position *struct {
								LatitudeDegrees  float64 `xml:"LatitudeDegrees"`
								LongitudeDegrees float64 `xml:"LongitudeDegrees"`
							} `xml:"Position"`
							AltitudeMeters *float64 `xml:"AltitudeMeters"`
							DistanceMeters *float64 `xml:"DistanceMeters"`
							HeartRateBpm   *struct {
								Value float64 `xml:"Value"`
							} `xml:"HeartRateBpm"`
							Extensions *struct {
								TPX *struct {
									Speed *float64 `xml:"Speed"`
								} `xml:"TPX"`
							} `xml:"Extensions"`
						} `xml:"Trackpoint"`
					} `xml:"Track"`
				} `xml:"Lap"`
			} `xml:"Activity"`
		} `xml:"Activities"`
	}

	if err := xml.Unmarshal(payload, &database); err != nil {
		return ActivityFile{Filename: filename, FileType: "TCX", Status: "error"}, fmt.Errorf("invalid TCX file: %w", err)
	}

	result := ActivityFile{
		ID:       fmt.Sprintf("tcx-%s", slugify(filename)),
		Filename: filename,
		FileType: "TCX",
		Status:   "success",
	}

	activities := database.Activities.Activity
	if len(activities) == 0 {
		return result, fmt.Errorf("TCX file does not contain activity data")
	}

	for _, activity := range activities {
		if result.ActivityDate == "" && activity.ID != "" {
			result.ActivityDate = activity.ID
		}
		for _, lap := range activity.Lap {
			if result.ActivityDate == "" && lap.StartTime != "" {
				result.ActivityDate = lap.StartTime
			}
			if result.DurationSeconds == 0 && lap.TotalTimeSeconds > 0 {
				result.DurationSeconds = lap.TotalTimeSeconds
			}
			if result.DistanceMeters == 0 && lap.DistanceMeters > 0 {
				result.DistanceMeters = lap.DistanceMeters
			}
			for _, point := range lap.Track.Trackpoint {
				record := ActivityRecord{Timestamp: point.Time}
				if point.Position != nil {
					lat := point.Position.LatitudeDegrees
					lon := point.Position.LongitudeDegrees
					record.Latitude = optionalFloat(lat)
					record.Longitude = optionalFloat(lon)
				}
				if point.AltitudeMeters != nil {
					record.Altitude = optionalFloat(*point.AltitudeMeters)
				}
				if point.DistanceMeters != nil {
					record.Distance = optionalFloat(*point.DistanceMeters)
				}
				if point.HeartRateBpm != nil {
					record.HeartRate = optionalFloat(point.HeartRateBpm.Value)
				}
				if point.Extensions != nil && point.Extensions.TPX != nil && point.Extensions.TPX.Speed != nil {
					record.Speed = optionalFloat(*point.Extensions.TPX.Speed)
				}
				result.Records = append(result.Records, record)
			}
		}
	}

	finalizeActivityFile(&result, filename)
	return result, nil
}

func finalizeActivityFile(result *ActivityFile, filename string) {
	var elevationGain float64
	var hrSum float64
	var hrCount int
	var prevAlt *float64
	for _, rec := range result.Records {
		if rec.Altitude != nil {
			if prevAlt != nil && *rec.Altitude > *prevAlt {
				elevationGain += *rec.Altitude - *prevAlt
			}
			altCopy := *rec.Altitude
			prevAlt = &altCopy
		}
		if rec.HeartRate != nil {
			hrSum += *rec.HeartRate
			hrCount++
		}
	}
	result.ElevationGain = elevationGain
	if hrCount > 0 {
		result.AvgHeartRate = hrSum / float64(hrCount)
	}
	if result.Name == "" {
		base := filename
		if idx := strings.LastIndex(base, "."); idx != -1 {
			base = base[:idx]
		}
		base = strings.ReplaceAll(base, "_", " ")
		base = strings.ReplaceAll(base, "-", " ")
		if len(base) > 0 {
			result.Name = strings.ToUpper(base[:1]) + base[1:]
		} else {
			result.Name = filename
		}
	}
	result.RecordCount = len(result.Records)
}

func fitRecordToActivityRecord(record fit.RecordMsg) ActivityRecord {
	activityRecord := ActivityRecord{Timestamp: formatOptionalTime(record.Timestamp)}
	if !record.PositionLat.Invalid() {
		v := record.PositionLat.Degrees()
		activityRecord.Latitude = optionalFloat(v)
	}
	if !record.PositionLong.Invalid() {
		v := record.PositionLong.Degrees()
		activityRecord.Longitude = optionalFloat(v)
	}
	if !math.IsNaN(record.GetAltitudeScaled()) {
		v := record.GetAltitudeScaled()
		activityRecord.Altitude = optionalFloat(v)
	}
	if !math.IsNaN(record.GetDistanceScaled()) {
		v := record.GetDistanceScaled()
		activityRecord.Distance = optionalFloat(v)
	}
	if !math.IsNaN(record.GetSpeedScaled()) {
		v := record.GetSpeedScaled()
		activityRecord.Speed = optionalFloat(v)
	}
	if record.HeartRate != 0xFF {
		v := float64(record.HeartRate)
		activityRecord.HeartRate = optionalFloat(v)
	}
	return activityRecord
}

func formatOptionalTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

func DetectFileType(filename string) string {
	switch {
	case strings.HasSuffix(strings.ToLower(filename), ".fit"):
		return "FIT"
	case strings.HasSuffix(strings.ToLower(filename), ".tcx"):
		return "TCX"
	default:
		return "unknown"
	}
}

func detectFileType(filename string) string {
	return DetectFileType(filename)
}

func optionalFloat(value float64) *float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}
	return &value
}

func Slugify(value string) string {
	base := strings.ToLower(value)
	base = strings.ReplaceAll(base, " ", "-")
	base = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			return r
		}
		return '-'
	}, base)
	return strings.Trim(base, "-.")
}

func slugify(value string) string {
	return Slugify(value)
}
