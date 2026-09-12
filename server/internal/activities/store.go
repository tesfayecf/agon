package activities

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type FileRecord struct {
	ID              string  `json:"id"`
	Filename        string  `json:"filename"`
	FileType        string  `json:"fileType"`
	S3Key           string  `json:"s3Key,omitempty"`
	FileSize        int64   `json:"fileSize"`
	ActivityDate    string  `json:"activityDate,omitempty"`
	DurationSeconds float64 `json:"durationSeconds,omitempty"`
	DistanceMeters  float64 `json:"distanceMeters,omitempty"`
	RecordCount     int     `json:"recordCount"`
	Status          string  `json:"status"`
	Error           string  `json:"error,omitempty"`
	CreatedAt       string  `json:"createdAt,omitempty"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Tags            string  `json:"tags"`
	ElevationGain   float64 `json:"elevationGain"`
	AvgHeartRate    float64 `json:"avgHeartRate"`
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
		avg_heart_rate REAL
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
	query := `
	INSERT OR REPLACE INTO files (id, filename, file_type, s3_key, file_size, activity_date, duration_seconds, distance_meters, record_count, status, error, created_at, name, description, tags, elevation_gain, avg_heart_rate)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.ExecContext(ctx, query,
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

func ListFileRecords(ctx context.Context, db *sql.DB) ([]FileRecord, error) {
	if db == nil {
		return []FileRecord{}, nil
	}
	query := `
	SELECT id, filename, file_type, s3_key, file_size, COALESCE(activity_date, ''), COALESCE(duration_seconds, 0), COALESCE(distance_meters, 0), record_count, status, COALESCE(error, ''), created_at, COALESCE(name, filename), COALESCE(description, ''), COALESCE(tags, ''), COALESCE(elevation_gain, 0), COALESCE(avg_heart_rate, 0)
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
		if err := rows.Scan(&r.ID, &r.Filename, &r.FileType, &r.S3Key, &r.FileSize, &r.ActivityDate, &r.DurationSeconds, &r.DistanceMeters, &r.RecordCount, &r.Status, &r.Error, &r.CreatedAt, &r.Name, &r.Description, &r.Tags, &r.ElevationGain, &r.AvgHeartRate); err != nil {
			return nil, fmt.Errorf("scan file record: %w", err)
		}
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
	SELECT id, filename, file_type, s3_key, file_size, COALESCE(activity_date, ''), COALESCE(duration_seconds, 0), COALESCE(distance_meters, 0), record_count, status, COALESCE(error, ''), created_at, COALESCE(name, filename), COALESCE(description, ''), COALESCE(tags, ''), COALESCE(elevation_gain, 0), COALESCE(avg_heart_rate, 0)
	FROM files
	WHERE id = ?
	`
	var r FileRecord
	err := db.QueryRowContext(ctx, query, id).Scan(
		&r.ID, &r.Filename, &r.FileType, &r.S3Key, &r.FileSize,
		&r.ActivityDate, &r.DurationSeconds, &r.DistanceMeters,
		&r.RecordCount, &r.Status, &r.Error, &r.CreatedAt,
		&r.Name, &r.Description, &r.Tags, &r.ElevationGain, &r.AvgHeartRate,
	)
	if err != nil {
		return FileRecord{}, fmt.Errorf("get file record %s: %w", id, err)
	}
	return r, nil
}

