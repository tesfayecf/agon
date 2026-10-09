package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/tesfayecf/agon/server/internal/activities"
)

// intervalTCX builds a TCX with one trackpoint per second: 5 min warm-up,
// 4 × (2 min fast / 2 min jog) and 3 min cool-down.
func intervalTCX() string {
	type phase struct {
		seconds int
		speed   float64
	}
	phases := []phase{{300, 2.8}}
	for i := 0; i < 4; i++ {
		phases = append(phases, phase{120, 4.5})
		if i < 3 {
			phases = append(phases, phase{120, 2.3})
		}
	}
	phases = append(phases, phase{180, 2.7})

	start := time.Date(2026, 9, 29, 17, 0, 0, 0, time.UTC)
	var points strings.Builder
	t, dist := 0, 0.0
	for _, p := range phases {
		for i := 0; i < p.seconds; i++ {
			dist += p.speed
			fmt.Fprintf(&points, "<Trackpoint><Time>%s</Time><DistanceMeters>%.1f</DistanceMeters><HeartRateBpm><Value>170</Value></HeartRateBpm></Trackpoint>",
				start.Add(time.Duration(t)*time.Second).Format(time.RFC3339), dist)
			t++
		}
	}
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>%s</Id><Lap StartTime="%s"><TotalTimeSeconds>%d</TotalTimeSeconds><DistanceMeters>%.1f</DistanceMeters><Track>%s</Track></Lap></Activity></Activities></TrainingCenterDatabase>`,
		start.Format(time.RFC3339), start.Format(time.RFC3339), t, dist, points.String())
}

func uploadTCX(t *testing.T, server *http.Server, filename, tcx string) string {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	_, _ = part.Write([]byte(tcx))
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/activities/upload", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp := httptest.NewRecorder()
	server.Handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("upload failed: %d %s", resp.Code, resp.Body.String())
	}
	var payload struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil || len(payload.Files) != 1 {
		t.Fatalf("decode upload response: %v %s", err, resp.Body.String())
	}
	return payload.Files[0].ID
}

func TestSaveActivityIntervalsByTimeAndDistance(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	id := uploadTCX(t, server, fmt.Sprintf("intervals-%d.tcx", time.Now().UnixNano()), intervalTCX())

	// Warm-up is 300 s at 2.8 m/s = 840 m; the first fast rep covers the next 120 s at 4.5 m/s = 540 m.
	body := `{"workoutType":"intervals","intervals":[
		{"kind":"warmup","basis":"time","start":0,"length":300},
		{"kind":"work","basis":"time","start":300,"length":120,"label":"Rep 1"},
		{"kind":"recovery","basis":"distance","start":1380,"length":276},
		{"kind":"work","basis":"distance","start":1656,"length":540,"label":"Rep 2"}]}`
	resp := doJSON(t, server, http.MethodPut, "/api/activities/"+id+"/workout", body)
	if resp.Code != http.StatusOK {
		t.Fatalf("save workout: expected 200, got %d %s", resp.Code, resp.Body.String())
	}

	// The detail endpoint returns the stored workout with server-derived stats.
	resp = doJSON(t, server, http.MethodGet, "/api/activities/"+id, "")
	var detail struct {
		WorkoutType string                `json:"workoutType"`
		Intervals   []activities.Interval `json:"intervals"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &detail); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if detail.WorkoutType != "intervals" || len(detail.Intervals) != 4 {
		t.Fatalf("expected 4 stored intervals, got type=%q n=%d", detail.WorkoutType, len(detail.Intervals))
	}
	rep1, rep2 := detail.Intervals[1], detail.Intervals[3]
	if rep1.Label != "Rep 1" || rep1.EndSeconds != 420 || rep1.AvgHeartRate != 170 || rep1.DistanceMeters < 535 || rep1.DistanceMeters > 545 {
		t.Fatalf("unexpected rep 1: %+v", rep1)
	}
	if rep2.Basis != "distance" || rep2.StartSeconds < 539 || rep2.StartSeconds > 541 || rep2.DurationSeconds < 118 || rep2.DurationSeconds > 122 {
		t.Fatalf("unexpected distance-based rep 2: %+v", rep2)
	}

	// Switching to another workout type clears the intervals.
	resp = doJSON(t, server, http.MethodPut, "/api/activities/"+id+"/workout", `{"workoutType":"tempo"}`)
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"intervals":[]`) {
		t.Fatalf("expected cleared intervals, got %d %s", resp.Code, resp.Body.String())
	}
}

func TestSaveWorkoutRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	server := newTestServer(t)
	id := uploadTCX(t, server, fmt.Sprintf("invalid-%d.tcx", time.Now().UnixNano()), intervalTCX())

	cases := map[string]string{
		"unknown type":          `{"workoutType":"sprint"}`,
		"intervals on easy run": `{"workoutType":"easy","intervals":[{"kind":"work","start":0,"length":60}]}`,
		"overlap":               `{"workoutType":"intervals","intervals":[{"kind":"work","start":0,"length":60},{"kind":"recovery","start":30,"length":60}]}`,
		"start past the end":    `{"workoutType":"intervals","intervals":[{"kind":"work","start":99999,"length":60}]}`,
		"distance past the end": `{"workoutType":"intervals","intervals":[{"kind":"work","basis":"distance","start":99999,"length":60}]}`,
		"malformed JSON":        `{"workoutType":`,
	}
	for name, body := range cases {
		if resp := doJSON(t, server, http.MethodPut, "/api/activities/"+id+"/workout", body); resp.Code != http.StatusBadRequest {
			t.Errorf("%s: expected 400, got %d %s", name, resp.Code, resp.Body.String())
		}
	}

	if resp := doJSON(t, server, http.MethodPut, "/api/activities/missing/workout", `{"workoutType":"easy"}`); resp.Code != http.StatusNotFound {
		t.Errorf("unknown id: expected 404, got %d", resp.Code)
	}
}

func doJSON(t *testing.T, server *http.Server, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp := httptest.NewRecorder()
	server.Handler.ServeHTTP(resp, req)
	return resp
}
