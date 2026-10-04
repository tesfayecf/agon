package activities

import (
	"context"
	"database/sql"
	"fmt"
)

// PayloadGetter reads a stored activity file. storage.Storage satisfies it.
type PayloadGetter interface {
	Get(ctx context.Context, key string) ([]byte, error)
}

// LoadActivityRecords returns the DB record and parsed track records of a training.
func LoadActivityRecords(ctx context.Context, db *sql.DB, store PayloadGetter, id string) (FileRecord, []ActivityRecord, error) {
	rec, err := GetFileRecord(ctx, db, id)
	if err != nil {
		return FileRecord{}, nil, err
	}
	if store == nil {
		return rec, nil, fmt.Errorf("storage not available")
	}
	payload, err := store.Get(ctx, rec.S3Key)
	if err != nil {
		return rec, nil, fmt.Errorf("read activity payload: %w", err)
	}
	parsed, err := ParseUploadFile(rec.Filename, payload)
	if err != nil {
		return rec, nil, fmt.Errorf("parse activity payload: %w", err)
	}
	return rec, parsed.Records, nil
}

// SaveWorkout validates and stores a training's workout type and intervals.
// Interval stats are always derived from the activity's track records; the
// stats sent by the caller are ignored. Validation failures wrap ErrInvalidWorkout.
func SaveWorkout(ctx context.Context, db *sql.DB, store PayloadGetter, id, workoutType string, intervals []Interval) (FileRecord, error) {
	validated, err := ValidateWorkout(workoutType, intervals)
	if err != nil {
		return FileRecord{}, err
	}
	// Fail on an unknown id first; the track is only needed to resolve intervals.
	if _, err := GetFileRecord(ctx, db, id); err != nil {
		return FileRecord{}, err
	}
	if len(validated) > 0 {
		_, records, _ := LoadActivityRecords(ctx, db, store, id)
		if validated, err = ResolveIntervals(records, validated); err != nil {
			return FileRecord{}, err
		}
	}
	if err := UpdateFileRecordWorkout(ctx, db, id, workoutType, validated); err != nil {
		return FileRecord{}, err
	}
	return GetFileRecord(ctx, db, id)
}
