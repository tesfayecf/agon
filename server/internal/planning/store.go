// Package planning stores user-defined training goals, the reusable weekly training
// schedule template, and specific planned sessions on calendar dates. It intentionally
// keeps a lightweight schema appropriate for a single-user, work-in-progress application.
package planning

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Goal is a measurable training objective, e.g. "40 km per week".
type Goal struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"` // "weekly_distance" | "monthly_distance"
	TargetMeters float64 `json:"targetMeters"`
	Active       bool    `json:"active"`
	CreatedAt    string  `json:"createdAt"`
}

const (
	GoalTypeWeeklyDistance  = "weekly_distance"
	GoalTypeMonthlyDistance = "monthly_distance"
)

// ScheduleSlot is one day of the reusable weekly schedule template.
// DayOfWeek is Monday-first: 0 = Monday .. 6 = Sunday.
type ScheduleSlot struct {
	DayOfWeek            int     `json:"dayOfWeek"`
	TrainingType         string  `json:"trainingType,omitempty"`
	Title                string  `json:"title,omitempty"`
	TargetDistanceMeters float64 `json:"targetDistanceMeters,omitempty"`
	TargetDurationSecs   float64 `json:"targetDurationSeconds,omitempty"`
	TargetPaceSecPerKm   float64 `json:"targetPaceSecondsPerKm,omitempty"`
	Notes                string  `json:"notes,omitempty"`
}

// PlannedSession is a planned training session on a specific calendar date.
type PlannedSession struct {
	ID                   string  `json:"id"`
	Date                 string  `json:"date"` // YYYY-MM-DD
	TrainingType         string  `json:"trainingType,omitempty"`
	Title                string  `json:"title,omitempty"`
	TargetDistanceMeters float64 `json:"targetDistanceMeters,omitempty"`
	TargetDurationSecs   float64 `json:"targetDurationSeconds,omitempty"`
	TargetPaceSecPerKm   float64 `json:"targetPaceSecondsPerKm,omitempty"`
	Notes                string  `json:"notes,omitempty"`
	CreatedAt            string  `json:"createdAt,omitempty"`
}

func EnsureTables(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS goals (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			target_meters REAL NOT NULL,
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS schedule_template (
			day_of_week INTEGER PRIMARY KEY,
			training_type TEXT,
			title TEXT,
			target_distance_meters REAL,
			target_duration_seconds REAL,
			target_pace_sec_per_km REAL,
			notes TEXT
		);`,
		`CREATE TABLE IF NOT EXISTS planned_sessions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			training_type TEXT,
			title TEXT,
			target_distance_meters REAL,
			target_duration_seconds REAL,
			target_pace_sec_per_km REAL,
			notes TEXT,
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_planned_sessions_date ON planned_sessions(date);`,
	}
	for _, stmt := range statements {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("ensure planning tables: %w", err)
		}
	}
	return nil
}

// --- Goals ---

func InsertGoal(ctx context.Context, db *sql.DB, g Goal) error {
	if g.CreatedAt == "" {
		g.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	_, err := db.ExecContext(ctx,
		`INSERT INTO goals (id, type, target_meters, active, created_at) VALUES (?, ?, ?, ?, ?)`,
		g.ID, g.Type, g.TargetMeters, boolToInt(g.Active), g.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert goal: %w", err)
	}
	return nil
}

func ListGoals(ctx context.Context, db *sql.DB) ([]Goal, error) {
	if db == nil {
		return []Goal{}, nil
	}
	rows, err := db.QueryContext(ctx, `SELECT id, type, target_meters, active, created_at FROM goals ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list goals: %w", err)
	}
	defer rows.Close()

	goals := make([]Goal, 0)
	for rows.Next() {
		var g Goal
		var active int
		if err := rows.Scan(&g.ID, &g.Type, &g.TargetMeters, &active, &g.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan goal: %w", err)
		}
		g.Active = active != 0
		goals = append(goals, g)
	}
	return goals, rows.Err()
}

func UpdateGoal(ctx context.Context, db *sql.DB, id string, targetMeters float64, active bool) error {
	res, err := db.ExecContext(ctx,
		`UPDATE goals SET target_meters = ?, active = ? WHERE id = ?`,
		targetMeters, boolToInt(active), id,
	)
	if err != nil {
		return fmt.Errorf("update goal: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("goal not found: %s", id)
	}
	return nil
}

func DeleteGoal(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM goals WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete goal: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("goal not found: %s", id)
	}
	return nil
}

// --- Weekly schedule template ---

func GetTemplate(ctx context.Context, db *sql.DB) ([]ScheduleSlot, error) {
	if db == nil {
		return []ScheduleSlot{}, nil
	}
	rows, err := db.QueryContext(ctx,
		`SELECT day_of_week, COALESCE(training_type, ''), COALESCE(title, ''), COALESCE(target_distance_meters, 0), COALESCE(target_duration_seconds, 0), COALESCE(target_pace_sec_per_km, 0), COALESCE(notes, '')
		FROM schedule_template ORDER BY day_of_week ASC`)
	if err != nil {
		return nil, fmt.Errorf("get schedule template: %w", err)
	}
	defer rows.Close()

	slots := make([]ScheduleSlot, 0, 7)
	for rows.Next() {
		var s ScheduleSlot
		if err := rows.Scan(&s.DayOfWeek, &s.TrainingType, &s.Title, &s.TargetDistanceMeters, &s.TargetDurationSecs, &s.TargetPaceSecPerKm, &s.Notes); err != nil {
			return nil, fmt.Errorf("scan schedule slot: %w", err)
		}
		slots = append(slots, s)
	}
	return slots, rows.Err()
}

// ReplaceTemplate overwrites the entire weekly template with the given slots.
func ReplaceTemplate(ctx context.Context, db *sql.DB, slots []ScheduleSlot) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin template tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM schedule_template`); err != nil {
		return fmt.Errorf("clear schedule template: %w", err)
	}

	for _, s := range slots {
		if s.DayOfWeek < 0 || s.DayOfWeek > 6 {
			continue
		}
		_, err := tx.ExecContext(ctx,
			`INSERT INTO schedule_template (day_of_week, training_type, title, target_distance_meters, target_duration_seconds, target_pace_sec_per_km, notes)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			s.DayOfWeek, s.TrainingType, s.Title, s.TargetDistanceMeters, s.TargetDurationSecs, s.TargetPaceSecPerKm, s.Notes,
		)
		if err != nil {
			return fmt.Errorf("insert schedule slot: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit schedule template: %w", err)
	}
	return nil
}

// --- Planned sessions ---

func InsertPlannedSession(ctx context.Context, db *sql.DB, s PlannedSession) error {
	if s.CreatedAt == "" {
		s.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	_, err := db.ExecContext(ctx,
		`INSERT INTO planned_sessions (id, date, training_type, title, target_distance_meters, target_duration_seconds, target_pace_sec_per_km, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Date, s.TrainingType, s.Title, s.TargetDistanceMeters, s.TargetDurationSecs, s.TargetPaceSecPerKm, s.Notes, s.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert planned session: %w", err)
	}
	return nil
}

func UpdatePlannedSession(ctx context.Context, db *sql.DB, s PlannedSession) error {
	res, err := db.ExecContext(ctx,
		`UPDATE planned_sessions SET date = ?, training_type = ?, title = ?, target_distance_meters = ?, target_duration_seconds = ?, target_pace_sec_per_km = ?, notes = ?
		WHERE id = ?`,
		s.Date, s.TrainingType, s.Title, s.TargetDistanceMeters, s.TargetDurationSecs, s.TargetPaceSecPerKm, s.Notes, s.ID,
	)
	if err != nil {
		return fmt.Errorf("update planned session: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("planned session not found: %s", s.ID)
	}
	return nil
}

func DeletePlannedSession(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM planned_sessions WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete planned session: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("planned session not found: %s", id)
	}
	return nil
}

func ListPlannedSessionsInRange(ctx context.Context, db *sql.DB, start, end string) ([]PlannedSession, error) {
	if db == nil {
		return []PlannedSession{}, nil
	}
	rows, err := db.QueryContext(ctx,
		`SELECT id, date, COALESCE(training_type, ''), COALESCE(title, ''), COALESCE(target_distance_meters, 0), COALESCE(target_duration_seconds, 0), COALESCE(target_pace_sec_per_km, 0), COALESCE(notes, ''), created_at
		FROM planned_sessions WHERE date >= ? AND date <= ? ORDER BY date ASC`,
		start, end,
	)
	if err != nil {
		return nil, fmt.Errorf("list planned sessions: %w", err)
	}
	defer rows.Close()

	sessions := make([]PlannedSession, 0)
	for rows.Next() {
		var s PlannedSession
		if err := rows.Scan(&s.ID, &s.Date, &s.TrainingType, &s.Title, &s.TargetDistanceMeters, &s.TargetDurationSecs, &s.TargetPaceSecPerKm, &s.Notes, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan planned session: %w", err)
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func GetPlannedSession(ctx context.Context, db *sql.DB, id string) (PlannedSession, error) {
	var s PlannedSession
	err := db.QueryRowContext(ctx,
		`SELECT id, date, COALESCE(training_type, ''), COALESCE(title, ''), COALESCE(target_distance_meters, 0), COALESCE(target_duration_seconds, 0), COALESCE(target_pace_sec_per_km, 0), COALESCE(notes, ''), created_at
		FROM planned_sessions WHERE id = ?`, id,
	).Scan(&s.ID, &s.Date, &s.TrainingType, &s.Title, &s.TargetDistanceMeters, &s.TargetDurationSecs, &s.TargetPaceSecPerKm, &s.Notes, &s.CreatedAt)
	if err != nil {
		return PlannedSession{}, fmt.Errorf("get planned session %s: %w", id, err)
	}
	return s, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
