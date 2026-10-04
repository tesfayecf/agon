package activities

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type FileRecord struct {
	ID              string     `json:"id"`
	Filename        string     `json:"filename"`
	FileType        string     `json:"fileType"`
	S3Key           string     `json:"s3Key,omitempty"`
	FileSize        int64      `json:"fileSize"`
	ActivityDate    string     `json:"activityDate,omitempty"`
	DurationSeconds float64    `json:"durationSeconds,omitempty"`
	DistanceMeters  float64    `json:"distanceMeters,omitempty"`
	RecordCount     int        `json:"recordCount"`
	Status          string     `json:"status"`
	Error           string     `json:"error,omitempty"`
	CreatedAt       string     `json:"createdAt,omitempty"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	Tags            string     `json:"tags"`
	ElevationGain   float64    `json:"elevationGain"`
	AvgHeartRate    float64    `json:"avgHeartRate"`
	WorkoutType     string     `json:"workoutType"`
	Intervals       []Interval `json:"intervals"`
}

func EnsureTable(ctx context.Context, db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS files (
		id TEXT PRIMARY KEY,
		filename TEXT NOT NULL,
		file_type TEXT NOT NULL,
		s3_key TEXT NOT NULL,
		file_size INTEGER NOT NULL,
		activity_date TEXT,
		duration_seconds REAL,
		distance_meters REAL,
		record_count INTEGER NOT NULL,
		status TEXT NOT NULL,
		error TEXT,
		created_at DATETIME NOT NULL,
		name TEXT,
		description TEXT,
		tags TEXT,
		elevation_gain REAL,
		avg_heart_rate REAL,
		workout_type TEXT,
		intervals TEXT
	);
	`
	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("create files table: %w", err)
	}

	columns := []string{
		"ALTER TABLE files ADD COLUMN name TEXT;",
		"ALTER TABLE files ADD COLUMN description TEXT;",
		"ALTER TABLE files ADD COLUMN tags TEXT;",
		"ALTER TABLE files ADD COLUMN elevation_gain REAL;",
		"ALTER TABLE files ADD COLUMN avg_heart_rate REAL;",
		"ALTER TABLE files ADD COLUMN workout_type TEXT;",
		"ALTER TABLE files ADD COLUMN intervals TEXT;",
	}
	for _, colQuery := range columns {
		_, _ = db.ExecContext(ctx, colQuery)
	}

	return nil
}

func InsertFileRecord(ctx context.Context, db *sql.DB, rec FileRecord) error {
	if db == nil {
		return nil
	}
	createdAt := rec.CreatedAt
	if createdAt == "" {
		createdAt = time.Now().UTC().Format(time.RFC3339)
	}
	name := rec.Name
	if name == "" {
		name = rec.Filename
	}
	intervalsJSON, err := encodeIntervals(rec.Intervals)
	if err != nil {
		return err
	}
	query := `
	INSERT OR REPLACE INTO files (id, filename, file_type, s3_key, file_size, activity_date, duration_seconds, distance_meters, record_count, status, error, created_at, name, description, tags, elevation_gain, avg_heart_rate, workout_type, intervals)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = db.ExecContext(ctx, query,
		rec.ID,
		rec.Filename,
		rec.FileType,
		rec.S3Key,
		rec.FileSize,
		rec.ActivityDate,
		rec.DurationSeconds,
		rec.DistanceMeters,
		rec.RecordCount,
		rec.Status,
		rec.Error,
		createdAt,
		name,
		rec.Description,
		rec.Tags,
		rec.ElevationGain,
		rec.AvgHeartRate,
		rec.WorkoutType,
		intervalsJSON,
	)
	if err != nil {
		return fmt.Errorf("insert file record: %w", err)
	}
	return nil
}

func UpdateFileRecordMetadata(ctx context.Context, db *sql.DB, id, name, description, tags string) error {
	if db == nil {
		return fmt.Errorf("database not available")
	}
	query := `
	UPDATE files
	SET name = ?, description = ?, tags = ?
	WHERE id = ?
	`
	res, err := db.ExecContext(ctx, query, name, description, tags, id)
	if err != nil {
		return fmt.Errorf("update file record metadata: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("file record not found: %s", id)
	}
	return nil
}

// UpdateFileRecordWorkout stores the workout type and interval segments of a
// training. Callers should validate with ValidateWorkout first.
func UpdateFileRecordWorkout(ctx context.Context, db *sql.DB, id, workoutType string, intervals []Interval) error {
	if db == nil {
		return fmt.Errorf("database not available")
	}
	intervalsJSON, err := encodeIntervals(intervals)
	if err != nil {
		return err
	}
	res, err := db.ExecContext(ctx, `UPDATE files SET workout_type = ?, intervals = ? WHERE id = ?`, workoutType, intervalsJSON, id)
	if err != nil {
		return fmt.Errorf("update file record workout: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("file record not found: %s", id)
	}
	return nil
}

func encodeIntervals(intervals []Interval) (string, error) {
	if len(intervals) == 0 {
		return "", nil
	}
	b, err := json.Marshal(intervals)
	if err != nil {
		return "", fmt.Errorf("encode intervals: %w", err)
	}
	return string(b), nil
}

func decodeIntervals(raw string) []Interval {
	intervals := []Interval{}
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &intervals)
	}
	return intervals
}

func DeleteFileRecord(ctx context.Context, db *sql.DB, id string) error {
	if db == nil {
		return fmt.Errorf("database not available")
	}
	res, err := db.ExecContext(ctx, `DELETE FROM files WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete file record: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("file record not found: %s", id)
	}
	return nil
}

func ListFileRecords(ctx context.Context, db *sql.DB) ([]FileRecord, error) {
	if db == nil {
		return []FileRecord{}, nil
	}
	query := `
	SELECT id, filename, file_type, s3_key, file_size, COALESCE(activity_date, ''), COALESCE(duration_seconds, 0), COALESCE(distance_meters, 0), record_count, status, COALESCE(error, ''), created_at, COALESCE(name, filename), COALESCE(description, ''), COALESCE(tags, ''), COALESCE(elevation_gain, 0), COALESCE(avg_heart_rate, 0), COALESCE(workout_type, ''), COALESCE(intervals, '')
	FROM files
	ORDER BY created_at DESC
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query file records: %w", err)
	}
	defer rows.Close()

	records := make([]FileRecord, 0)
	for rows.Next() {
		var r FileRecord
		var intervalsJSON string
		if err := rows.Scan(&r.ID, &r.Filename, &r.FileType, &r.S3Key, &r.FileSize, &r.ActivityDate, &r.DurationSeconds, &r.DistanceMeters, &r.RecordCount, &r.Status, &r.Error, &r.CreatedAt, &r.Name, &r.Description, &r.Tags, &r.ElevationGain, &r.AvgHeartRate, &r.WorkoutType, &intervalsJSON); err != nil {
			return nil, fmt.Errorf("scan file record: %w", err)
		}
		r.Intervals = decodeIntervals(intervalsJSON)
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows file records: %w", err)
	}
	return records, nil
}

func GetFileRecord(ctx context.Context, db *sql.DB, id string) (FileRecord, error) {
	if db == nil {
		return FileRecord{}, fmt.Errorf("database not available")
	}
	query := `
	SELECT id, filename, file_type, s3_key, file_size, COALESCE(activity_date, ''), COALESCE(duration_seconds, 0), COALESCE(distance_meters, 0), record_count, status, COALESCE(error, ''), created_at, COALESCE(name, filename), COALESCE(description, ''), COALESCE(tags, ''), COALESCE(elevation_gain, 0), COALESCE(avg_heart_rate, 0), COALESCE(workout_type, ''), COALESCE(intervals, '')
	FROM files
	WHERE id = ?
	`
	var r FileRecord
	var intervalsJSON string
	err := db.QueryRowContext(ctx, query, id).Scan(
		&r.ID, &r.Filename, &r.FileType, &r.S3Key, &r.FileSize,
		&r.ActivityDate, &r.DurationSeconds, &r.DistanceMeters,
		&r.RecordCount, &r.Status, &r.Error, &r.CreatedAt,
		&r.Name, &r.Description, &r.Tags, &r.ElevationGain, &r.AvgHeartRate,
		&r.WorkoutType, &intervalsJSON,
	)
	if err != nil {
		return FileRecord{}, fmt.Errorf("get file record %s: %w", id, err)
	}
	r.Intervals = decodeIntervals(intervalsJSON)
	return r, nil
}
