package sqlite

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenMigrateAndBackup(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "app.db")
	db, err := Open(ctx, Config{Path: databasePath})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	err = Migrate(ctx, db, []Migration{{
		Version: 1,
		SQL:     "CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
	}})
	if err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	if err := IntegrityCheck(ctx, db); err != nil {
		t.Fatalf("check database integrity: %v", err)
	}

	version, err := CurrentSchemaVersion(ctx, db)
	if err != nil {
		t.Fatalf("read schema version: %v", err)
	}
	if version != 1 {
		t.Fatalf("expected schema version 1, got %d", version)
	}

	backupPath, err := BackupDatabase(ctx, db, filepath.Join(t.TempDir(), "backups"), version)
	if err != nil {
		t.Fatalf("backup database: %v", err)
	}
	if _, err := os.Stat(backupPath); err != nil {
		t.Fatalf("stat backup: %v", err)
	}
}

func TestOpenQuarantinesCorruptDatabase(t *testing.T) {
	t.Parallel()

	databasePath := filepath.Join(t.TempDir(), "app.db")
	if err := os.WriteFile(databasePath, []byte("not sqlite"), 0o644); err != nil {
		t.Fatalf("write corrupt database: %v", err)
	}

	db, err := Open(context.Background(), Config{Path: databasePath})
	if err != nil {
		t.Fatalf("open quarantined database: %v", err)
	}
	defer db.Close()

	backups, err := filepath.Glob(databasePath + ".corrupt-*")
	if err != nil {
		t.Fatalf("find quarantined database: %v", err)
	}
	if len(backups) != 1 {
		t.Fatalf("expected one quarantined database, got %d", len(backups))
	}
}
