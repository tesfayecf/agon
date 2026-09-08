package httpapi

import (
	"log/slog"
	"net/http"

	"example.com/app-template/server/internal/config"
)

// NewServer composes the API routes and HTTP middleware used by the application.
func NewServer(cfg config.Config, logger *slog.Logger) *http.Server {
	mux := http.NewServeMux()
	registerHealthRoutes(mux)

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
