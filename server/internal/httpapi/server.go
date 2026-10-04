package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"example.com/app-template/server/internal/activities"
	"example.com/app-template/server/internal/config"
	"example.com/app-template/server/internal/planning"
	"example.com/app-template/server/internal/profile"
	"example.com/app-template/server/internal/sqlite"
	"example.com/app-template/server/internal/storage"
	"example.com/app-template/server/internal/trainingplan"
)

// NewServer composes the API routes and HTTP middleware used by the application.
func NewServer(cfg config.Config, logger *slog.Logger) *http.Server {
	var db *sql.DB
	if cfg.Database.Enabled {
		var err error
		db, err = sqlite.Open(context.Background(), sqlite.Config{Path: cfg.Database.Path})
		if err == nil && db != nil {
			_ = activities.EnsureTable(context.Background(), db)
			_ = planning.EnsureTables(context.Background(), db)
			_ = trainingplan.EnsureTables(context.Background(), db)
			_ = profile.EnsureTables(context.Background(), db)
		}
	}

	store, err := storage.NewStorage(cfg.S3)
	if err != nil {
		logger.Warn("initialize s3 storage", "error", err)
	}

	mux := http.NewServeMux()
	registerHealthRoutes(mux)
	registerActivityRoutes(mux, db, store)
	registerAnalyticsRoutes(mux, db)
	registerPlanningRoutes(mux, db)
	registerProfileRoutes(mux, db)
	registerTrainingPlanRoutes(mux, db)
	registerMCPRoutes(mux, db, store)

	return &http.Server{
		Addr:              cfg.HTTP.Address,
		Handler:           LoggingMiddleware(logger, CORSMiddleware(cfg.AllowedOrigins, mux)),
		ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
	}
}

func registerHealthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health/live", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/health/ready", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
}

func registerActivityRoutes(mux *http.ServeMux, db *sql.DB, store storage.Storage) {
	// Dashboard overview stats
	mux.HandleFunc("GET /api/dashboard", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list records: %v", err))
			return
		}

		var totalDistance, totalElevation, totalDuration, hrSum float64
		var hrCount int
		for _, rec := range records {
			if rec.Status == "success" {
				totalDistance += rec.DistanceMeters
				totalElevation += rec.ElevationGain
				totalDuration += rec.DurationSeconds
				if rec.AvgHeartRate > 0 {
					hrSum += rec.AvgHeartRate
					hrCount++
				}
			}
		}
		var avgHR float64
		if hrCount > 0 {
			avgHR = hrSum / float64(hrCount)
		}

		now := time.Now()
		currentWeekDistance, currentWeekSessions := activities.CurrentWeekDistance(records, now)
		currentMonthDistance, currentMonthSessions := activities.CurrentMonthDistance(records, now)

		goals := []GoalWithProgress{}
		if db != nil {
			if storedGoals, err := planning.ListGoals(r.Context(), db); err == nil {
				for _, g := range storedGoals {
					if g.Active {
						goals = append(goals, withProgress(g, records, now))
					}
				}
			}
		}

		// The predictor degrades to the best-effort method when the profile is missing.
		athlete, _ := profile.Get(r.Context(), db)
		hrBounds := activities.HeartRateBounds{Resting: athlete.RestingHeartRate, Max: athlete.MaxHeartRate}

		WriteJSON(w, http.StatusOK, map[string]any{
			"totalDistance":        totalDistance,
			"totalElevation":       totalElevation,
			"totalDuration":        totalDuration,
			"trainingCount":        len(records),
			"avgHeartRate":         avgHR,
			"currentWeekDistance":  currentWeekDistance,
			"currentWeekSessions":  currentWeekSessions,
			"currentMonthDistance": currentMonthDistance,
			"currentMonthSessions": currentMonthSessions,
			"weeklyTrend":          activities.WeeklyTrend(records, 8, now),
			"monthlyTrend":         activities.MonthlyTrend(records, 6, now),
			"paceTrend":            activities.PaceTrend(records, 8, now),
			"heartRateTrend":       activities.HeartRateTrend(records, 8, now),
			"paceHeartRatePoints":  activities.PaceHeartRateSeries(records),
			"personalBests":        activities.PersonalBests(records),
			"trainingLoad":         activities.ComputeTrainingLoad(records, now),
			"goals":                goals,
			"endurance":            activities.ComputeEnduranceAnalytics(records, 12, now),
			"intervals":            activities.ComputeIntervalAnalytics(records, 12, now),
			"racePredictor":        activities.ComputeRacePredictor(records, hrBounds, now),
		})
	})

	// List uploaded files from DB, with optional search/filter query params.
	mux.HandleFunc("GET /api/activities", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list files: %v", err))
			return
		}
		filtered := filterActivityRecords(records, r.URL.Query())
		WriteJSON(w, http.StatusOK, map[string]any{"files": filtered, "count": len(filtered)})
	})

	// Get specific file content / parsed details from S3 & DB
	mux.HandleFunc("GET /api/activities/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			WriteError(w, http.StatusBadRequest, "missing file id")
			return
		}

		rec, err := activities.GetFileRecord(r.Context(), db, id)
		if err != nil {
			WriteError(w, http.StatusNotFound, fmt.Sprintf("file not found: %v", err))
			return
		}

		if store == nil {
			WriteError(w, http.StatusInternalServerError, "storage not available")
			return
		}

		payload, err := store.Get(r.Context(), rec.S3Key)
		if err != nil {
			WriteError(w, http.StatusNotFound, fmt.Sprintf("file payload not found in storage: %v", err))
			return
		}

		parsed, parseErr := activities.ParseUploadFile(rec.Filename, payload)
		if parseErr != nil {
			parsed = activities.ActivityFile{
				ID:          rec.ID,
				Filename:    rec.Filename,
				FileType:    rec.FileType,
				Status:      "error",
				Error:       parseErr.Error(),
				Name:        rec.Name,
				Description: rec.Description,
				Tags:        rec.Tags,
			}
		} else {
			parsed.ID = rec.ID
		}

		parsed.Name = rec.Name
		parsed.Description = rec.Description
		parsed.Tags = rec.Tags
		parsed.WorkoutType = rec.WorkoutType
		parsed.Intervals = rec.Intervals
		if rec.ElevationGain > 0 {
			parsed.ElevationGain = rec.ElevationGain
		}
		if rec.AvgHeartRate > 0 {
			parsed.AvgHeartRate = rec.AvgHeartRate
		}

		WriteJSON(w, http.StatusOK, parsed)
	})
	// Update training metadata
	mux.HandleFunc("PUT /api/activities/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			WriteError(w, http.StatusBadRequest, "missing file id")
			return
		}
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Tags        string `json:"tags"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		if err := activities.UpdateFileRecordMetadata(r.Context(), db, id, req.Name, req.Description, req.Tags); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		rec, err := activities.GetFileRecord(r.Context(), db, id)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, rec)
	})

	// Mark a training's workout type and set its interval segments
	mux.HandleFunc("PUT /api/activities/{id}/workout", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var req struct {
			WorkoutType string                `json:"workoutType"`
			Intervals   []activities.Interval `json:"intervals"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		rec, err := activities.SaveWorkout(r.Context(), db, store, id, req.WorkoutType, req.Intervals)
		if err != nil {
			status := http.StatusNotFound
			if errors.Is(err, activities.ErrInvalidWorkout) {
				status = http.StatusBadRequest
			}
			WriteError(w, status, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, rec)
	})

	// Delete a training: removes the stored payload and the DB record
	mux.HandleFunc("DELETE /api/activities/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			WriteError(w, http.StatusBadRequest, "missing file id")
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		rec, err := activities.GetFileRecord(r.Context(), db, id)
		if err != nil {
			WriteError(w, http.StatusNotFound, fmt.Sprintf("file not found: %v", err))
			return
		}
		if err := activities.DeleteFileRecord(r.Context(), db, id); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		// Best effort: the record is already gone, so a storage failure must not fail the request.
		if store != nil && rec.S3Key != "" {
			_ = store.Delete(r.Context(), rec.S3Key)
		}
		WriteJSON(w, http.StatusOK, map[string]any{"id": id, "deleted": true})
	})

	// Upload files to S3 and save metadata to DB
	mux.HandleFunc("POST /api/activities/upload", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			WriteError(w, http.StatusBadRequest, fmt.Sprintf("invalid upload: %v", err))
			return
		}

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			WriteError(w, http.StatusBadRequest, "no files were uploaded")
			return
		}

		results := make([]activities.ActivityFile, 0, len(files))
		hasFailure := false
		ctx := r.Context()

		for _, fileHeader := range files {
			file, err := fileHeader.Open()
			if err != nil {
				hasFailure = true
				results = append(results, activities.ActivityFile{Filename: fileHeader.Filename, FileType: strings.TrimSpace(fileHeader.Header.Get("Content-Type")), Status: "error", Error: err.Error()})
				continue
			}

			payload, err := io.ReadAll(file)
			_ = file.Close()
			if err != nil {
				hasFailure = true
				results = append(results, activities.ActivityFile{Filename: fileHeader.Filename, FileType: strings.TrimSpace(fileHeader.Header.Get("Content-Type")), Status: "error", Error: err.Error()})
				continue
			}

			parsed, parseErr := activities.ParseUploadFile(fileHeader.Filename, payload)
			if parseErr != nil {
				hasFailure = true
				parsed = activities.ActivityFile{Filename: fileHeader.Filename, FileType: activities.DetectFileType(fileHeader.Filename), Status: "error", Error: parseErr.Error()}
			}

			if parsed.ID == "" {
				parsed.ID = fmt.Sprintf("file-%d-%s", time.Now().UnixNano(), activities.Slugify(fileHeader.Filename))
			}

			s3Key := fmt.Sprintf("activities/%s/%s", parsed.ID, fileHeader.Filename)
			if store != nil {
				contentType := fileHeader.Header.Get("Content-Type")
				if contentType == "" {
					contentType = "application/octet-stream"
				}
				_ = store.Upload(ctx, s3Key, payload, contentType)
			}

			fileRec := activities.FileRecord{
				ID:              parsed.ID,
				Filename:        parsed.Filename,
				FileType:        parsed.FileType,
				S3Key:           s3Key,
				FileSize:        int64(len(payload)),
				ActivityDate:    parsed.ActivityDate,
				DurationSeconds: parsed.DurationSeconds,
				DistanceMeters:  parsed.DistanceMeters,
				RecordCount:     parsed.RecordCount,
				Status:          parsed.Status,
				Error:           parsed.Error,
				CreatedAt:       time.Now().UTC().Format(time.RFC3339),
				Name:            parsed.Name,
				Description:     parsed.Description,
				Tags:            parsed.Tags,
				ElevationGain:   parsed.ElevationGain,
				AvgHeartRate:    parsed.AvgHeartRate,
			}

			if db != nil {
				_ = activities.InsertFileRecord(ctx, db, fileRec)
			}

			results = append(results, parsed)
		}

		statusCode := http.StatusOK
		if hasFailure {
			statusCode = http.StatusBadRequest
		}
		WriteJSON(w, statusCode, map[string]any{"files": results})
	})
}
