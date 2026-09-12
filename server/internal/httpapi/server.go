package httpapi

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"example.com/app-template/server/internal/activities"
	"example.com/app-template/server/internal/config"
	"example.com/app-template/server/internal/sqlite"
	"example.com/app-template/server/internal/storage"
)

// NewServer composes the API routes and HTTP middleware used by the application.
func NewServer(cfg config.Config, logger *slog.Logger) *http.Server {
	var db *sql.DB
	if cfg.Database.Enabled {
		var err error
		db, err = sqlite.Open(context.Background(), sqlite.Config{Path: cfg.Database.Path})
		if err == nil && db != nil {
			_ = activities.EnsureTable(context.Background(), db)
		}
	}

	store, err := storage.NewStorage(cfg.S3)
	if err != nil {
		logger.Warn("initialize s3 storage", "error", err)
	}

	mux := http.NewServeMux()
	registerHealthRoutes(mux)
	registerActivityRoutes(mux, db, store)

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
	// List uploaded files from DB
	mux.HandleFunc("GET /api/activities", func(w http.ResponseWriter, r *http.Request) {
		records, err := activities.ListFileRecords(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list files: %v", err))
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"files": records})
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
				ID:       rec.ID,
				Filename: rec.Filename,
				FileType: rec.FileType,
				Status:   "error",
				Error:    parseErr.Error(),
			}
		} else {
			parsed.ID = rec.ID
		}

		WriteJSON(w, http.StatusOK, parsed)
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

