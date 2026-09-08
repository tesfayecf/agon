package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func IntegrityCheck(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, "PRAGMA quick_check")
	if err != nil {
		return fmt.Errorf("run sqlite integrity check: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var result string
		if err := rows.Scan(&result); err != nil {
			return fmt.Errorf("scan sqlite integrity check: %w", err)
		}
		if strings.TrimSpace(strings.ToLower(result)) != "ok" {
			return fmt.Errorf("sqlite integrity check failed: %s", result)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("read sqlite integrity check: %w", err)
	}

	return nil
}

func BackupDatabase(ctx context.Context, db *sql.DB, backupDir string, schemaVersion int) (string, error) {
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		return "", fmt.Errorf("create sqlite backup directory: %w", err)
	}

	version := "unknown"
	if schemaVersion >= 0 {
		version = fmt.Sprintf("v%d", schemaVersion)
	}
	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05")
	backupPath := filepath.Join(backupDir, fmt.Sprintf("backup_%s_%s.dump", timestamp, version))
	for attempt := 1; ; attempt++ {
		if _, err := os.Stat(backupPath); os.IsNotExist(err) {
			break
		}
		backupPath = filepath.Join(backupDir, fmt.Sprintf("backup_%s_%s_%d.dump", timestamp, version, attempt))
	}

	if _, err := db.ExecContext(ctx, "VACUUM INTO ?", backupPath); err != nil {
		return "", fmt.Errorf("write sqlite backup: %w", err)
	}

	return backupPath, nil
}
