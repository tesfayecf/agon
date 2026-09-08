package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Migration struct {
	SQL     string
	Version int
}

func CurrentSchemaVersion(ctx context.Context, db *sql.DB) (int, error) {
	var version int
	if err := db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return 0, fmt.Errorf("read sqlite schema version: %w", err)
	}

	return version, nil
}

func Migrate(ctx context.Context, db *sql.DB, migrations []Migration) error {
	if err := validateMigrations(migrations); err != nil {
		return err
	}

	currentVersion, err := CurrentSchemaVersion(ctx, db)
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		if migration.Version <= currentVersion {
			continue
		}

		transaction, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin sqlite migration %d: %w", migration.Version, err)
		}

		if strings.TrimSpace(migration.SQL) != "" {
			if _, err := transaction.ExecContext(ctx, migration.SQL); err != nil {
				_ = transaction.Rollback()
				return fmt.Errorf("apply sqlite migration %d: %w", migration.Version, err)
			}
		}
		if _, err := transaction.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", migration.Version)); err != nil {
			_ = transaction.Rollback()
			return fmt.Errorf("set sqlite schema version %d: %w", migration.Version, err)
		}
		if err := transaction.Commit(); err != nil {
			return fmt.Errorf("commit sqlite migration %d: %w", migration.Version, err)
		}

		currentVersion = migration.Version
	}

	return nil
}

func validateMigrations(migrations []Migration) error {
	previousVersion := 0
	for _, migration := range migrations {
		if migration.Version <= previousVersion {
			return fmt.Errorf("sqlite migrations must be in strictly increasing version order")
		}
		previousVersion = migration.Version
	}

	return nil
}
