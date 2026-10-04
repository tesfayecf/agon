package mcp

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"example.com/app-template/server/internal/activities"
	"example.com/app-template/server/internal/sqlite"
)

func TestSetActivityWorkoutTool(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db, err := sqlite.Open(ctx, sqlite.Config{Path: filepath.Join(t.TempDir(), "mcp.db")})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()
	if err := activities.EnsureTable(ctx, db); err != nil {
		t.Fatalf("ensure table: %v", err)
	}
	if err := activities.InsertFileRecord(ctx, db, activities.FileRecord{ID: "fit-a", Filename: "a.fit", FileType: "FIT", S3Key: "k", Status: "success"}); err != nil {
		t.Fatalf("insert: %v", err)
	}
	tools := NewAgonToolProvider(db, nil)

	names := map[string]bool{}
	for _, tool := range tools.List(ctx) {
		names[tool.Name] = true
	}
	if !names["set_activity_workout"] || names["detect_intervals"] {
		t.Fatalf("expected only the manual workout tool, got %v", names)
	}

	call := func(args string) string {
		t.Helper()
		parts, err := tools.Call(ctx, "set_activity_workout", args)
		if err != nil || len(parts) == 0 {
			t.Fatalf("call: %v", err)
		}
		return parts[0].Text
	}

	out := call(`{"activityId":"fit-a","workoutType":"intervals","intervals":[{"kind":"work","start":60,"length":120,"label":"Rep 1"}]}`)
	if !strings.Contains(out, "Workout updated") {
		t.Fatalf("expected success, got %q", out)
	}
	rec, _ := activities.GetFileRecord(ctx, db, "fit-a")
	if rec.WorkoutType != "intervals" || len(rec.Intervals) != 1 || rec.Intervals[0].DurationSeconds != 120 {
		t.Fatalf("expected stored interval, got %+v", rec)
	}

	res := NewAgonResourceProvider(db, nil)
	if out, err := res.Read(ctx, "agon://activities/fit-a/workout"); err != nil || !strings.Contains(out, `"workoutType":"intervals"`) || !strings.Contains(out, `"label":"Rep 1"`) {
		t.Fatalf("expected workout resource, got %q %v", out, err)
	}

	if out := call(`{"activityId":"fit-a","workoutType":"easy","intervals":[{"kind":"work","start":0,"length":10}]}`); !strings.Contains(out, "Failed") {
		t.Fatalf("expected validation failure, got %q", out)
	}
	if out := call(`{"activityId":"missing","workoutType":"easy"}`); !strings.Contains(out, "Failed") {
		t.Fatalf("expected not-found failure, got %q", out)
	}
}
