package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const defaultBusyTimeout = 5 * time.Second

type Config struct {
	BusyTimeout time.Duration
	Path        string
}

func Open(ctx context.Context, cfg Config) (*sql.DB, error) {
	if strings.TrimSpace(cfg.Path) == "" {
		return nil, fmt.Errorf("sqlite path is required")
	}

	path, err := filepath.Abs(cfg.Path)
	if err != nil {
		return nil, fmt.Errorf("resolve sqlite path: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create sqlite directory: %w", err)
	}

	busyTimeout := cfg.BusyTimeout
	if busyTimeout <= 0 {
		busyTimeout = defaultBusyTimeout
	}
	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(%d)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)&_txlock=immediate",
		filepath.ToSlash(path),
		busyTimeout.Milliseconds(),
	)

	db, err := openDatabase(ctx, dsn)
	if err == nil {
		return db, nil
	}
	if !isCorruptDatabaseError(err) {
		return nil, err
	}

	backupPath, backupErr := quarantineCorruptDatabase(path)
	if backupErr != nil {
		return nil, fmt.Errorf("%w; quarantine corrupt sqlite database: %v", err, backupErr)
	}

	db, retryErr := openDatabase(ctx, dsn)
	if retryErr != nil {
		return nil, fmt.Errorf("%w; quarantined corrupt sqlite database at %s but reopen failed: %v", err, backupPath, retryErr)
	}

	return db, nil
}

func openDatabase(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping sqlite database: %w", err)
	}

	return db, nil
}

func isCorruptDatabaseError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "database disk image is malformed") ||
		strings.Contains(message, "file is not a database") ||
		strings.Contains(message, "database schema is corrupt")
}

func quarantineCorruptDatabase(path string) (string, error) {
	backupPath := nextCorruptDatabasePath(path)
	if err := renameIfExists(path, backupPath); err != nil {
		return "", err
	}
	if err := renameIfExists(path+"-wal", backupPath+"-wal"); err != nil {
		return "", err
	}
	if err := renameIfExists(path+"-shm", backupPath+"-shm"); err != nil {
		return "", err
	}

	return backupPath, nil
}

func nextCorruptDatabasePath(path string) string {
	base := fmt.Sprintf("%s.corrupt-%s", path, time.Now().UTC().Format("20060102-150405"))
	if _, err := os.Stat(base); os.IsNotExist(err) {
		return base
	}

	for attempt := 1; ; attempt++ {
		candidate := fmt.Sprintf("%s-%d", base, attempt)
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
}

func renameIfExists(from string, to string) error {
	if _, err := os.Stat(from); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("stat %s: %w", from, err)
	}
	if err := os.Rename(from, to); err != nil {
		return fmt.Errorf("rename %s to %s: %w", from, to, err)
	}

	return nil
}
