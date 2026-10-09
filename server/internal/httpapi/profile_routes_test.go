package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/tesfayecf/agon/server/internal/profile"
)

func TestProfileRoundTripWithDerivedMetrics(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	getResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(getResp, httptest.NewRequest(http.MethodGet, "/api/profile", nil))
	if getResp.Code != http.StatusOK || !strings.Contains(getResp.Body.String(), `"heightCm":0`) {
		t.Fatalf("expected empty profile, got %d: %s", getResp.Code, getResp.Body.String())
	}

	body := `{"heightCm":180,"weightKg":72,"birthDate":"1990-01-15","sex":"male","restingHeartRate":50,"maxHeartRate":190}`
	putResp := httptest.NewRecorder()
	server.Handler.ServeHTTP(putResp, httptest.NewRequest(http.MethodPut, "/api/profile", strings.NewReader(body)))
	if putResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", putResp.Code, putResp.Body.String())
	}

	getResp2 := httptest.NewRecorder()
	server.Handler.ServeHTTP(getResp2, httptest.NewRequest(http.MethodGet, "/api/profile", nil))
	var got profile.WithDerived
	if err := json.Unmarshal(getResp2.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if got.WeightKg != 72 || got.MaxHeartRate != 190 || got.BirthDate != "1990-01-15" {
		t.Fatalf("profile not persisted: %+v", got.Profile)
	}
	if got.Derived.BMI != 22.2 || got.Derived.HeartRateReserve != 140 || got.Derived.AgeYears <= 0 {
		t.Fatalf("unexpected derived metrics: %+v", got.Derived)
	}
}

func TestProfileRejectsImplausibleValues(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	for _, body := range []string{
		`{"heightCm":20}`,
		`{"weightKg":900}`,
		`{"birthDate":"15/01/1990"}`,
		`{"sex":"robot"}`,
		`{"restingHeartRate":60,"maxHeartRate":55}`,
	} {
		resp := httptest.NewRecorder()
		server.Handler.ServeHTTP(resp, httptest.NewRequest(http.MethodPut, "/api/profile", strings.NewReader(body)))
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for %s, got %d", body, resp.Code)
		}
	}
}

func TestDashboardIncludesRacePredictor(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)

	resp := httptest.NewRecorder()
	server.Handler.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/api/dashboard", nil))
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"racePredictor":{"method":"none"`) {
		t.Fatalf("expected empty race predictor, got %d: %s", resp.Code, resp.Body.String())
	}
}
