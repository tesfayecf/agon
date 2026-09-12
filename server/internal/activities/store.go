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
		created_at DATETIME NOT NULL
	);
	`
	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("create files table: %w", err)
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
	query := `
	INSERT OR REPLACE INTO files (id, filename, file_type, s3_key, file_size, activity_date, duration_seconds, distance_meters, record_count, status, error, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
	)
	if err != nil {
		return fmt.Errorf("insert file record: %w", err)
	}
	return nil
}

func ListFileRecords(ctx context.Context, db *sql.DB) ([]FileRecord, error) {
	if db == nil {
		return []FileRecord{}, nil
	}
	query := `
	SELECT id, filename, file_type, s3_key, file_size, COALESCE(activity_date, ''), COALESCE(duration_seconds, 0), COALESCE(distance_meters, 0), record_count, status, COALESCE(error, ''), created_at
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
		if err := rows.Scan(&r.ID, &r.Filename, &r.FileType, &r.S3Key, &r.FileSize, &r.ActivityDate, &r.DurationSeconds, &r.DistanceMeters, &r.RecordCount, &r.Status, &r.Error, &r.CreatedAt); err != nil {
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
	SELECT id, filename, file_type, s3_key, file_size, COALESCE(activity_date, ''), COALESCE(duration_seconds, 0), COALESCE(distance_meters, 0), record_count, status, COALESCE(error, ''), created_at
	FROM files
	WHERE id = ?
	`
	var r FileRecord
	err := db.QueryRowContext(ctx, query, id).Scan(
		&r.ID, &r.Filename, &r.FileType, &r.S3Key, &r.FileSize,
		&r.ActivityDate, &r.DurationSeconds, &r.DistanceMeters,
		&r.RecordCount, &r.Status, &r.Error, &r.CreatedAt,
	)
	if err != nil {
		return FileRecord{}, fmt.Errorf("get file record %s: %w", id, err)
	}
	return r, nil
}
