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

func TestDeleteFileRecord(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "delete_test.db")
	db, err := sqlite.Open(ctx, sqlite.Config{Path: databasePath})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()

	if err := EnsureTable(ctx, db); err != nil {
		t.Fatalf("ensure table: %v", err)
	}

	rec := FileRecord{
		ID:       "fit-delete-me",
		Filename: "delete.fit",
		FileType: "FIT",
		S3Key:    "activities/fit-delete-me/delete.fit",
		Status:   "success",
	}
	if err := InsertFileRecord(ctx, db, rec); err != nil {
		t.Fatalf("insert record: %v", err)
	}

	if err := DeleteFileRecord(ctx, db, rec.ID); err != nil {
		t.Fatalf("delete record: %v", err)
	}

	records, err := ListFileRecords(ctx, db)
	if err != nil {
		t.Fatalf("list records: %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("expected 0 records after delete, got %d", len(records))
	}

	if err := DeleteFileRecord(ctx, db, rec.ID); err == nil {
		t.Fatal("expected error when deleting a missing record")
	}
}

func TestUpdateFileRecordWorkoutRoundTrip(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db, err := sqlite.Open(ctx, sqlite.Config{Path: filepath.Join(t.TempDir(), "workout_test.db")})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()
	if err := EnsureTable(ctx, db); err != nil {
		t.Fatalf("ensure table: %v", err)
	}
	if err := InsertFileRecord(ctx, db, FileRecord{ID: "fit-w", Filename: "w.fit", FileType: "FIT", S3Key: "k", Status: "success"}); err != nil {
		t.Fatalf("insert: %v", err)
	}

	intervals := []Interval{{Kind: IntervalKindWork, Basis: IntervalBasisTime, Start: 60, Length: 120, Label: "Rep 1", DistanceMeters: 500}}
	if err := UpdateFileRecordWorkout(ctx, db, "fit-w", WorkoutTypeIntervals, intervals); err != nil {
		t.Fatalf("update workout: %v", err)
	}
	got, err := GetFileRecord(ctx, db, "fit-w")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.WorkoutType != WorkoutTypeIntervals || len(got.Intervals) != 1 || got.Intervals[0].Label != "Rep 1" || got.Intervals[0].DistanceMeters != 500 {
		t.Fatalf("unexpected workout round trip: %+v", got)
	}

	if err := UpdateFileRecordWorkout(ctx, db, "fit-w", "", nil); err != nil {
		t.Fatalf("clear workout: %v", err)
	}
	list, _ := ListFileRecords(ctx, db)
	if list[0].WorkoutType != "" || list[0].Intervals == nil || len(list[0].Intervals) != 0 {
		t.Fatalf("expected cleared workout with empty (non-nil) intervals, got %+v", list[0])
	}

	if err := UpdateFileRecordWorkout(ctx, db, "missing", WorkoutTypeEasy, nil); err == nil {
		t.Fatal("expected not-found error for unknown id")
	}
}
