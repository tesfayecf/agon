package httpapi

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"example.com/app-template/server/internal/activities"
	"example.com/app-template/server/internal/planning"
)

// GoalWithProgress augments a stored goal with computed progress against completed training.
type GoalWithProgress struct {
	planning.Goal
	AchievedMeters  float64 `json:"achievedMeters"`
	RemainingMeters float64 `json:"remainingMeters"`
	PercentComplete float64 `json:"percentComplete"`
	PeriodStart     string  `json:"periodStart"`
	PeriodEnd       string  `json:"periodEnd"`
}

// CalendarPlannedEntry is a planned session as displayed for one calendar day, either an
// explicit planned session or a fallback derived from the reusable weekly template.
type CalendarPlannedEntry struct {
	ID                     string  `json:"id,omitempty"`
	TrainingType           string  `json:"trainingType,omitempty"`
	Title                  string  `json:"title,omitempty"`
	TargetDistanceMeters   float64 `json:"targetDistanceMeters,omitempty"`
	TargetDurationSeconds  float64 `json:"targetDurationSeconds,omitempty"`
	TargetPaceSecondsPerKm float64 `json:"targetPaceSecondsPerKm,omitempty"`
	Notes                  string  `json:"notes,omitempty"`
	IsTemplateDefault      bool    `json:"isTemplateDefault"`
	IsCompleted            bool    `json:"isCompleted"`
}

type CalendarDayView struct {
	Date      string                  `json:"date"`
	IsToday   bool                    `json:"isToday"`
	Completed []activities.FileRecord `json:"completed"`
	Planned   []CalendarPlannedEntry  `json:"planned"`
}

func registerPlanningRoutes(mux *http.ServeMux, db *sql.DB) {
	registerGoalRoutes(mux, db)
	registerScheduleRoutes(mux, db)
}

func registerGoalRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/goals", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteJSON(w, http.StatusOK, map[string]any{"goals": []GoalWithProgress{}})
			return
		}
		goals, err := planning.ListGoals(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		result := make([]GoalWithProgress, 0, len(goals))
		for _, g := range goals {
			result = append(result, withProgress(g, records, time.Now()))
		}
		WriteJSON(w, http.StatusOK, map[string]any{"goals": result})
	})

	mux.HandleFunc("POST /api/goals", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req struct {
			Type         string  `json:"type"`
			TargetMeters float64 `json:"targetMeters"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if req.Type != planning.GoalTypeWeeklyDistance && req.Type != planning.GoalTypeMonthlyDistance {
			WriteError(w, http.StatusBadRequest, "type must be weekly_distance or monthly_distance")
			return
		}
		if req.TargetMeters <= 0 {
			WriteError(w, http.StatusBadRequest, "targetMeters must be greater than zero")
			return
		}
		goal := planning.Goal{
			ID:           fmt.Sprintf("goal-%d", time.Now().UnixNano()),
			Type:         req.Type,
			TargetMeters: req.TargetMeters,
			Active:       true,
			CreatedAt:    time.Now().UTC().Format(time.RFC3339),
		}
		if err := planning.InsertGoal(r.Context(), db, goal); err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		records, _ := activities.ListFileRecords(r.Context(), db)
		WriteJSON(w, http.StatusCreated, withProgress(goal, records, time.Now()))
	})

	mux.HandleFunc("PUT /api/goals/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req struct {
			TargetMeters float64 `json:"targetMeters"`
			Active       bool    `json:"active"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if req.TargetMeters <= 0 {
			WriteError(w, http.StatusBadRequest, "targetMeters must be greater than zero")
			return
		}
		if err := planning.UpdateGoal(r.Context(), db, id, req.TargetMeters, req.Active); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		goals, err := planning.ListGoals(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		records, _ := activities.ListFileRecords(r.Context(), db)
		for _, g := range goals {
			if g.ID == id {
				WriteJSON(w, http.StatusOK, withProgress(g, records, time.Now()))
				return
			}
		}
		WriteError(w, http.StatusNotFound, "goal not found")
	})

	mux.HandleFunc("DELETE /api/goals/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		if err := planning.DeleteGoal(r.Context(), db, id); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})
}

func registerScheduleRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/schedule/template", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteJSON(w, http.StatusOK, map[string]any{"days": []planning.ScheduleSlot{}})
			return
		}
		slots, err := planning.GetTemplate(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"days": slots})
	})

	mux.HandleFunc("PUT /api/schedule/template", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req struct {
			Days []planning.ScheduleSlot `json:"days"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if err := planning.ReplaceTemplate(r.Context(), db, req.Days); err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		slots, err := planning.GetTemplate(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"days": slots})
	})

	mux.HandleFunc("GET /api/schedule/planned", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteJSON(w, http.StatusOK, map[string]any{"sessions": []planning.PlannedSession{}})
			return
		}
		start := r.URL.Query().Get("start")
		end := r.URL.Query().Get("end")
		if start == "" || end == "" {
			WriteError(w, http.StatusBadRequest, "start and end query parameters are required (YYYY-MM-DD)")
			return
		}
		sessions, err := planning.ListPlannedSessionsInRange(r.Context(), db, start, end)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
	})

	mux.HandleFunc("POST /api/schedule/planned", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req planning.PlannedSession
		if !DecodeJSON(w, r, &req) {
			return
		}
		if req.Date == "" {
			WriteError(w, http.StatusBadRequest, "date is required (YYYY-MM-DD)")
			return
		}
		req.ID = fmt.Sprintf("planned-%d", time.Now().UnixNano())
		req.CreatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := planning.InsertPlannedSession(r.Context(), db, req); err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusCreated, req)
	})

	mux.HandleFunc("PUT /api/schedule/planned/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req planning.PlannedSession
		if !DecodeJSON(w, r, &req) {
			return
		}
		req.ID = id
		if req.Date == "" {
			WriteError(w, http.StatusBadRequest, "date is required (YYYY-MM-DD)")
			return
		}
		if err := planning.UpdatePlannedSession(r.Context(), db, req); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		updated, err := planning.GetPlannedSession(r.Context(), db, id)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, updated)
	})

	mux.HandleFunc("DELETE /api/schedule/planned/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		if err := planning.DeletePlannedSession(r.Context(), db, id); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	})

	mux.HandleFunc("GET /api/calendar/week", func(w http.ResponseWriter, r *http.Request) {
		anchor := time.Now().UTC()
		if raw := r.URL.Query().Get("date"); raw != "" {
			if parsed, err := time.Parse("2006-01-02", raw); err == nil {
				anchor = parsed
			}
		}
		weekStart := time.Date(anchor.Year(), anchor.Month(), anchor.Day(), 0, 0, 0, 0, time.UTC)
		offset := (int(weekStart.Weekday()) + 6) % 7
		weekStart = weekStart.AddDate(0, 0, -offset)
		weekEnd := weekStart.AddDate(0, 0, 6)
		today := time.Now().UTC().Format("2006-01-02")

		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		byDate := make(map[string][]activities.FileRecord)
		for _, rec := range records {
			if rec.Status != "success" || rec.ActivityDate == "" {
				continue
			}
			t, err := time.Parse(time.RFC3339, rec.ActivityDate)
			if err != nil {
				continue
			}
			key := t.UTC().Format("2006-01-02")
			byDate[key] = append(byDate[key], rec)
		}

		var planned []planning.PlannedSession
		var template []planning.ScheduleSlot
		if db != nil {
			planned, err = planning.ListPlannedSessionsInRange(r.Context(), db, weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02"))
			if err != nil {
				WriteError(w, http.StatusInternalServerError, err.Error())
				return
			}
			template, err = planning.GetTemplate(r.Context(), db)
			if err != nil {
				WriteError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}
		plannedByDate := make(map[string][]planning.PlannedSession)
		for _, p := range planned {
			plannedByDate[p.Date] = append(plannedByDate[p.Date], p)
		}
		templateByDay := make(map[int]planning.ScheduleSlot)
		for _, slot := range template {
			templateByDay[slot.DayOfWeek] = slot
		}

		days := make([]CalendarDayView, 0, 7)
		for i := 0; i < 7; i++ {
			date := weekStart.AddDate(0, 0, i)
			key := date.Format("2006-01-02")
			completed := byDate[key]
			if completed == nil {
				completed = []activities.FileRecord{}
			}
			isCompleted := len(completed) == 1

			plannedEntries := []CalendarPlannedEntry{}
			if explicit, ok := plannedByDate[key]; ok && len(explicit) > 0 {
				for _, p := range explicit {
					plannedEntries = append(plannedEntries, CalendarPlannedEntry{
						ID:                     p.ID,
						TrainingType:           p.TrainingType,
						Title:                  p.Title,
						TargetDistanceMeters:   p.TargetDistanceMeters,
						TargetDurationSeconds:  p.TargetDurationSecs,
						TargetPaceSecondsPerKm: p.TargetPaceSecPerKm,
						Notes:                  p.Notes,
						IsTemplateDefault:      false,
						IsCompleted:            isCompleted,
					})
				}
			} else if slot, ok := templateByDay[i]; ok && (slot.TrainingType != "" || slot.Title != "" || slot.TargetDistanceMeters > 0) {
				plannedEntries = append(plannedEntries, CalendarPlannedEntry{
					TrainingType:           slot.TrainingType,
					Title:                  slot.Title,
					TargetDistanceMeters:   slot.TargetDistanceMeters,
					TargetDurationSeconds:  slot.TargetDurationSecs,
					TargetPaceSecondsPerKm: slot.TargetPaceSecPerKm,
					Notes:                  slot.Notes,
					IsTemplateDefault:      true,
					IsCompleted:            isCompleted,
				})
			}

			days = append(days, CalendarDayView{
				Date:      key,
				IsToday:   key == today,
				Completed: completed,
				Planned:   plannedEntries,
			})
		}

		WriteJSON(w, http.StatusOK, map[string]any{
			"weekStart": weekStart.Format("2006-01-02"),
			"weekEnd":   weekEnd.Format("2006-01-02"),
			"days":      days,
		})
	})
}

func withProgress(g planning.Goal, records []activities.FileRecord, now time.Time) GoalWithProgress {
	var achieved float64
	var periodStart, periodEnd time.Time
	switch g.Type {
	case planning.GoalTypeMonthlyDistance:
		achieved, _ = activities.CurrentMonthDistance(records, now)
		periodStart = time.Date(now.UTC().Year(), now.UTC().Month(), 1, 0, 0, 0, 0, time.UTC)
		periodEnd = periodStart.AddDate(0, 1, 0).AddDate(0, 0, -1)
	default: // weekly_distance
		monday := time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC)
		offset := (int(monday.Weekday()) + 6) % 7
		monday = monday.AddDate(0, 0, -offset)
		achieved, _ = activities.CurrentWeekDistance(records, now)
		periodStart = monday
		periodEnd = monday.AddDate(0, 0, 6)
	}

	remaining := g.TargetMeters - achieved
	if remaining < 0 {
		remaining = 0
	}
	var percent float64
	if g.TargetMeters > 0 {
		percent = (achieved / g.TargetMeters) * 100
		if percent > 100 {
			percent = 100
		}
	}

	return GoalWithProgress{
		Goal:            g,
		AchievedMeters:  achieved,
		RemainingMeters: remaining,
		PercentComplete: percent,
		PeriodStart:     periodStart.Format("2006-01-02"),
		PeriodEnd:       periodEnd.Format("2006-01-02"),
	}
}
