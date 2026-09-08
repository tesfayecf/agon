package httpapi

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"example.com/app-template/server/internal/activities"
	"example.com/app-template/server/internal/config"
)

// NewServer composes the API routes and HTTP middleware used by the application.
func NewServer(cfg config.Config, logger *slog.Logger) *http.Server {
	mux := http.NewServeMux()
	registerHealthRoutes(mux)
	registerActivityRoutes(mux)

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

func registerActivityRoutes(mux *http.ServeMux) {
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
			results = append(results, parsed)
		}

		statusCode := http.StatusOK
		if hasFailure {
			statusCode = http.StatusBadRequest
		}
		WriteJSON(w, statusCode, map[string]any{"files": results})
	})
}
