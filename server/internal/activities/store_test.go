package activities

import (
	"context"
	"path/filepath"
	"testing"

	"example.com/app-template/server/internal/sqlite"
)

func TestFileRecordsStore(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "store_test.db")
	db, err := sqlite.Open(ctx, sqlite.Config{Path: databasePath})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()

	if err := EnsureTable(ctx, db); err != nil {
		t.Fatalf("ensure table: %v", err)
	}

	rec := FileRecord{
		ID:              "fit-sample-123",
		Filename:        "sample.fit",
		FileType:        "FIT",
		S3Key:           "activities/fit-sample-123/sample.fit",
		FileSize:        1024,
		ActivityDate:    "2026-09-08T17:05:27Z",
		DurationSeconds: 120.5,
		DistanceMeters:  500.0,
		RecordCount:     10,
		Status:          "success",
	}

	if err := InsertFileRecord(ctx, db, rec); err != nil {
		t.Fatalf("insert record: %v", err)
	}

	records, err := ListFileRecords(ctx, db)
	if err != nil {
		t.Fatalf("list records: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	if records[0].ID != rec.ID || records[0].Filename != rec.Filename {
		t.Fatalf("record mismatch: got %+v, want %+v", records[0], rec)
	}

	got, err := GetFileRecord(ctx, db, rec.ID)
	if err != nil {
		t.Fatalf("get record: %v", err)
	}

	if got.ID != rec.ID {
		t.Fatalf("got ID %s, want %s", got.ID, rec.ID)
	}
}
