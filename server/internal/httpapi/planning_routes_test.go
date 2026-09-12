package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/app-template/server/internal/config"
)

func newTestServer(t *testing.T) *http.Server {
	t.Helper()
	dbPath := t.TempDir() + "/test.db"
	return NewServer(config.Config{
		AllowedOrigins: []string{"http://localhost:3000"},
		Database: config.DatabaseConfig{
			Enabled: true,
			Path:    dbPath,
		},
		HTTP: config.HTTPConfig{
			ReadHeaderTimeout: time.Second,
			ReadTimeout:       time.Second,
			WriteTimeout:      time.Second,
			IdleTimeout:       time.Second,
		},
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func TestGoalCreateUpdateProgressAndDelete(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	createReq := httptest.NewRequest(http.MethodPost, "/api/goals", strings.NewReader(`{"type":"weekly_distance","targetMeters":40000}`))
	createResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(createResp, createReq)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", createResp.Code, createResp.Body.String())
	}

	var created GoalWithProgress
	if err := json.Unmarshal(createResp.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created goal: %v", err)
	}
	if created.TargetMeters != 40000 || created.PercentComplete != 0 {
		t.Fatalf("unexpected created goal: %+v", created)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/goals", nil)
	listResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(listResp, listReq)
	if listResp.Code != http.StatusOK || !strings.Contains(listResp.Body.String(), created.ID) {
		t.Fatalf("expected goal in list, got %d: %s", listResp.Code, listResp.Body.String())
	}

	updateReq := httptest.NewRequest(http.MethodPut, "/api/goals/"+created.ID, strings.NewReader(`{"targetMeters":50000,"active":true}`))
	updateResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(updateResp, updateReq)
	if updateResp.Code != http.StatusOK {
		t.Fatalf("expected 200 updating goal, got %d: %s", updateResp.Code, updateResp.Body.String())
	}
	var updated GoalWithProgress
	_ = json.Unmarshal(updateResp.Body.Bytes(), &updated)
	if updated.TargetMeters != 50000 {
		t.Fatalf("expected updated target 50000, got %v", updated.TargetMeters)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/goals/"+created.ID, nil)
	deleteResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(deleteResp, deleteReq)
	if deleteResp.Code != http.StatusOK {
		t.Fatalf("expected 200 deleting goal, got %d", deleteResp.Code)
	}

	listReq2 := httptest.NewRequest(http.MethodGet, "/api/goals", nil)
	listResp2 := httptest.NewRecorder()
	server.Handler.ServeHTTP(listResp2, listReq2)
	if strings.Contains(listResp2.Body.String(), created.ID) {
		t.Fatalf("expected goal to be removed from list, got %s", listResp2.Body.String())
	}
}

func TestGoalCreationRejectsInvalidType(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	req := httptest.NewRequest(http.MethodPost, "/api/goals", strings.NewReader(`{"type":"bogus","targetMeters":1000}`))
	resp := httptest.NewRecorder()
	server.Handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid goal type, got %d", resp.Code)
	}
}

func TestScheduleTemplateRoundTrip(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	putBody := `{"days":[{"dayOfWeek":0,"trainingType":"rest"},{"dayOfWeek":1,"trainingType":"intervals","title":"Track session","targetDistanceMeters":8000}]}`
	putReq := httptest.NewRequest(http.MethodPut, "/api/schedule/template", strings.NewReader(putBody))
	putResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(putResp, putReq)
	if putResp.Code != http.StatusOK {
		t.Fatalf("expected 200 saving template, got %d: %s", putResp.Code, putResp.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/schedule/template", nil)
	getResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(getResp, getReq)
	if getResp.Code != http.StatusOK || !strings.Contains(getResp.Body.String(), "Track session") {
		t.Fatalf("expected template to contain 'Track session', got %d: %s", getResp.Code, getResp.Body.String())
	}
}

func TestDashboardGoalsFieldIsNeverNullWithNoGoals(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	resp := httptest.NewRecorder()
	server.Handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if strings.Contains(resp.Body.String(), `"goals":null`) {
		t.Fatalf("expected an empty array, not null, for goals with none defined: %s", resp.Body.String())
	}
}

func TestCalendarWeekNeverReturnsNullArraysForEmptyDays(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/calendar/week?date=2026-09-09", nil)
	resp := httptest.NewRecorder()
	server.Handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if strings.Contains(resp.Body.String(), `"completed":null`) || strings.Contains(resp.Body.String(), `"planned":null`) {
		t.Fatalf("expected empty arrays, not null, for days without data: %s", resp.Body.String())
	}
}

func TestPlannedSessionCRUDAndCalendarWeek(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	createBody := `{"date":"2026-09-09","trainingType":"tempo","title":"Tempo run","targetDistanceMeters":10000}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/schedule/planned", strings.NewReader(createBody))
	createResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(createResp, createReq)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 creating planned session, got %d: %s", createResp.Code, createResp.Body.String())
	}

	var created struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(createResp.Body.Bytes(), &created)
	if created.ID == "" {
		t.Fatalf("expected planned session id")
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/schedule/planned?start=2026-09-01&end=2026-09-30", nil)
	listResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(listResp, listReq)
	if listResp.Code != http.StatusOK || !strings.Contains(listResp.Body.String(), "Tempo run") {
		t.Fatalf("expected planned session in range list, got %d: %s", listResp.Code, listResp.Body.String())
	}

	weekReq := httptest.NewRequest(http.MethodGet, "/api/calendar/week?date=2026-09-09", nil)
	weekResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(weekResp, weekReq)
	if weekResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for calendar week, got %d: %s", weekResp.Code, weekResp.Body.String())
	}
	var weekPayload struct {
		WeekStart string `json:"weekStart"`
		Days      []struct {
			Date    string `json:"date"`
			Planned []struct {
				Title             string `json:"title"`
				IsTemplateDefault bool   `json:"isTemplateDefault"`
			} `json:"planned"`
		} `json:"days"`
	}
	if err := json.Unmarshal(weekResp.Body.Bytes(), &weekPayload); err != nil {
		t.Fatalf("decode calendar week: %v", err)
	}
	if weekPayload.WeekStart != "2026-09-07" {
		t.Fatalf("expected week to start Monday 2026-09-07, got %s", weekPayload.WeekStart)
	}
	found := false
	for _, day := range weekPayload.Days {
		if day.Date != "2026-09-09" {
			continue
		}
		for _, p := range day.Planned {
			if p.Title == "Tempo run" && !p.IsTemplateDefault {
				found = true
			}
		}
	}
	if !found {
		t.Fatalf("expected explicit planned session to appear in calendar week: %+v", weekPayload)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/schedule/planned/"+created.ID, nil)
	deleteResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(deleteResp, deleteReq)
	if deleteResp.Code != http.StatusOK {
		t.Fatalf("expected 200 deleting planned session, got %d", deleteResp.Code)
	}
}
