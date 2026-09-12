package httpapi

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"example.com/app-template/server/internal/activities"
)

func registerAnalyticsRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/analytics/weekly-trend", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}
		weeks := intQueryParam(r, "weeks", 12)
		WriteJSON(w, http.StatusOK, map[string]any{
			"points": activities.WeeklyTrend(records, weeks, time.Now()),
		})
	})

	mux.HandleFunc("GET /api/analytics/monthly-trend", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}
		months := intQueryParam(r, "months", 12)
		WriteJSON(w, http.StatusOK, map[string]any{
			"points": activities.MonthlyTrend(records, months, time.Now()),
		})
	})

	mux.HandleFunc("GET /api/analytics/pace-trend", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}
		weeks := intQueryParam(r, "weeks", 12)
		WriteJSON(w, http.StatusOK, map[string]any{
			"points": activities.PaceTrend(records, weeks, time.Now()),
		})
	})

	mux.HandleFunc("GET /api/analytics/heart-rate-trend", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}
		weeks := intQueryParam(r, "weeks", 12)
		WriteJSON(w, http.StatusOK, map[string]any{
			"points": activities.HeartRateTrend(records, weeks, time.Now()),
		})
	})

	mux.HandleFunc("GET /api/analytics/pace-heartrate", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{
			"points": activities.PaceHeartRateSeries(records),
		})
	})

	mux.HandleFunc("GET /api/analytics/personal-bests", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{
			"bests": activities.PersonalBests(records),
		})
	})
}

func intQueryParam(r *http.Request, name string, fallback int) int {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}
