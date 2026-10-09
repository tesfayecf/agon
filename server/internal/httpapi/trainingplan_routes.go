package httpapi

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/tesfayecf/agon/server/internal/trainingplan"
)

func registerTrainingPlanRoutes(mux *http.ServeMux, db *sql.DB) {
	// List training plans, optionally filtered by status
	mux.HandleFunc("GET /api/training-plans", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteJSON(w, http.StatusOK, map[string]any{"plans": []trainingplan.TrainingPlan{}})
			return
		}
		statusFilter := r.URL.Query().Get("status")
		plans, err := trainingplan.ListPlans(r.Context(), db, statusFilter)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"plans": plans})
	})

	// Get a specific training plan with its sessions
	mux.HandleFunc("GET /api/training-plans/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			WriteError(w, http.StatusBadRequest, "missing plan id")
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		plan, sessions, err := trainingplan.GetPlan(r.Context(), db, id)
		if err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{
			"plan":     plan,
			"sessions": sessions,
		})
	})

	// Create a new training plan (with optional sessions)
	mux.HandleFunc("POST /api/training-plans", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req struct {
			Plan     trainingplan.TrainingPlan        `json:"plan"`
			Sessions []trainingplan.TrainingPlanSession `json:"sessions"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if req.Plan.Title == "" {
			WriteError(w, http.StatusBadRequest, "plan.title is required")
			return
		}

		req.Plan.ID = fmt.Sprintf("plan-%d", time.Now().UnixNano())
		req.Plan.Status = trainingplan.PlanStatusDraft
		req.Plan.SessionCount = len(req.Sessions)
		req.Plan.CreatedAt = time.Now().UTC().Format(time.RFC3339)

		// Assign IDs to sessions
		for i, _ := range req.Sessions {
			if req.Sessions[i].ID == "" {
				req.Sessions[i].ID = fmt.Sprintf("tps-%d-%d", time.Now().UnixNano(), i)
			}
			req.Sessions[i].PlanID = req.Plan.ID
		}

		if err := trainingplan.InsertPlan(r.Context(), db, req.Plan, req.Sessions); err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}

		WriteJSON(w, http.StatusCreated, map[string]any{
			"plan":     req.Plan,
			"sessions": req.Sessions,
		})
	})

	// Update training plan status (draft → active → archived)
	mux.HandleFunc("PUT /api/training-plans/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			WriteError(w, http.StatusBadRequest, "missing plan id")
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		var req struct {
			Status string `json:"status"`
		}
		if !DecodeJSON(w, r, &req) {
			return
		}
		if req.Status != trainingplan.PlanStatusDraft &&
		   req.Status != trainingplan.PlanStatusActive &&
		   req.Status != trainingplan.PlanStatusArchived {
			WriteError(w, http.StatusBadRequest,
				fmt.Sprintf("status must be one of: %s, %s, %s",
					trainingplan.PlanStatusDraft,
					trainingplan.PlanStatusActive,
					trainingplan.PlanStatusArchived))
			return
		}
		if err := trainingplan.UpdatePlanStatus(r.Context(), db, id, req.Status); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	})

	// Delete a training plan (cascade-deletes sessions)
	mux.HandleFunc("DELETE /api/training-plans/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			WriteError(w, http.StatusBadRequest, "missing plan id")
			return
		}
		if db == nil {
			WriteError(w, http.StatusInternalServerError, "database not available")
			return
		}
		if err := trainingplan.DeletePlan(r.Context(), db, id); err != nil {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		WriteJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	})
}