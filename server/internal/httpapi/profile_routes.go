package httpapi

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/tesfayecf/agon/server/internal/profile"
)

func registerProfileRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/profile", func(w http.ResponseWriter, r *http.Request) {
		p, err := profile.Get(r.Context(), db)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, profile.WithDerived{Profile: p, Derived: p.Derive(time.Now())})
	})

	mux.HandleFunc("PUT /api/profile", func(w http.ResponseWriter, r *http.Request) {
		var req profile.Profile
		if !DecodeJSON(w, r, &req) {
			return
		}
		now := time.Now()
		if err := req.Validate(now); err != nil {
			WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		saved, err := profile.Save(r.Context(), db, req)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, profile.WithDerived{Profile: saved, Derived: saved.Derive(now)})
	})
}
