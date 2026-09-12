package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/app-template/server/internal/config"
)

func TestNewServerHealthEndpoints(t *testing.T) {
	t.Parallel()

	server := NewServer(config.Config{
		AllowedOrigins: []string{"http://localhost:3000"},
		HTTP: config.HTTPConfig{
			ReadHeaderTimeout: time.Second,
			ReadTimeout:       time.Second,
			WriteTimeout:      time.Second,
			IdleTimeout:       time.Second,
		},
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	request := httptest.NewRequest(http.MethodGet, "/api/health/live", nil)
	response := httptest.NewRecorder()
	server.Handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !strings.Contains(response.Body.String(), `"status":"ok"`) {
		t.Fatalf("expected live response, got %q", response.Body.String())
	}
}

func TestCORSMiddlewareAllowsConfiguredOrigin(t *testing.T) {
	t.Parallel()

	handler := CORSMiddleware([]string{"http://localhost:3000"}, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodOptions, "/api/example", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Headers", "Content-Type")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("expected allowed origin, got %q", got)
	}
}

func TestDecodeJSONRejectsMalformedBody(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodPost, "/api/example", strings.NewReader("{"))
	response := httptest.NewRecorder()
	var payload struct {
		Name string `json:"name"`
	}

	if DecodeJSON(response, request, &payload) {
		t.Fatal("expected malformed JSON to be rejected")
	}
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
}

func TestUploadActivityEndpointAcceptsTCX(t *testing.T) {
	t.Parallel()

	server := NewServer(config.Config{
		AllowedOrigins: []string{"http://localhost:3000"},
		HTTP: config.HTTPConfig{
			ReadHeaderTimeout: time.Second,
			ReadTimeout:       time.Second,
			WriteTimeout:      time.Second,
			IdleTimeout:       time.Second,
		},
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "activity.tcx")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}

	tcx := `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-09-08T17:05:27Z</Id>
      <Lap StartTime="2026-09-08T17:05:27Z">
        <TotalTimeSeconds>154.0</TotalTimeSeconds>
        <DistanceMeters>914.0</DistanceMeters>
        <MaximumSpeed>5.4</MaximumSpeed>
        <Calories>149</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          <Trackpoint>
            <Time>2026-09-08T17:05:27Z</Time>
            <Position>
              <LatitudeDegrees>51.5</LatitudeDegrees>
              <LongitudeDegrees>-0.1</LongitudeDegrees>
            </Position>
            <AltitudeMeters>123.0</AltitudeMeters>
            <DistanceMeters>0.0</DistanceMeters>
            <HeartRateBpm>
              <Value>141</Value>
            </HeartRateBpm>
            <Extensions>
              <TPX>
                <Speed>2.8</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-09-08T17:06:27Z</Time>
            <Position>
              <LatitudeDegrees>51.5005</LatitudeDegrees>
              <LongitudeDegrees>-0.1005</LongitudeDegrees>
            </Position>
            <AltitudeMeters>124.0</AltitudeMeters>
            <DistanceMeters>100.0</DistanceMeters>
            <HeartRateBpm>
              <Value>151</Value>
            </HeartRateBpm>
            <Extensions>
              <TPX>
                <Speed>3.1</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

	if _, err = part.Write([]byte(tcx)); err != nil {
		t.Fatalf("write tcx data: %v", err)
	}
	if err = writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/activities/upload", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()

	server.Handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusOK, response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), "activity.tcx") {
		t.Fatalf("expected uploaded filename in response, got %q", response.Body.String())
	}
	if !strings.Contains(response.Body.String(), "51.5") {
		t.Fatalf("expected parsed GPS data in response, got %q", response.Body.String())
	}
}

func TestUploadActivityEndpointRejectsUnsupportedFileType(t *testing.T) {
	t.Parallel()

	server := NewServer(config.Config{
		AllowedOrigins: []string{"http://localhost:3000"},
		HTTP: config.HTTPConfig{
			ReadHeaderTimeout: time.Second,
			ReadTimeout:       time.Second,
			WriteTimeout:      time.Second,
			IdleTimeout:       time.Second,
		},
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "notes.txt")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err = part.Write([]byte("hello")); err != nil {
		t.Fatalf("write txt data: %v", err)
	}
	if err = writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/activities/upload", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()

	server.Handler.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, response.Code, response.Body.String())
	}
}

func TestUploadActivityEndpointRejectsMalformedFIT(t *testing.T) {
	t.Parallel()

	server := NewServer(config.Config{
		AllowedOrigins: []string{"http://localhost:3000"},
		HTTP: config.HTTPConfig{
			ReadHeaderTimeout: time.Second,
			ReadTimeout:       time.Second,
			WriteTimeout:      time.Second,
			IdleTimeout:       time.Second,
		},
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "broken.fit")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err = part.Write([]byte("not-a-fit-file")); err != nil {
		t.Fatalf("write fit bytes: %v", err)
	}
	if err = writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/activities/upload", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()

	server.Handler.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d with body %s", http.StatusBadRequest, response.Code, response.Body.String())
	}
}

func TestListAndGetActivitiesEndpoints(t *testing.T) {
	t.Parallel()

	dbPath := t.TempDir() + "/test.db"
	server := NewServer(config.Config{
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

	// First list activities (should be empty array)
	reqList := httptest.NewRequest(http.MethodGet, "/api/activities", nil)
	respList := httptest.NewRecorder()
	server.Handler.ServeHTTP(respList, reqList)

	if respList.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", respList.Code)
	}

	// Upload a file
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "test.tcx")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	tcx := `<?xml version="1.0" encoding="UTF-8"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2026-09-08T17:05:27Z</Id><Lap StartTime="2026-09-08T17:05:27Z"><TotalTimeSeconds>10.0</TotalTimeSeconds><DistanceMeters>50.0</DistanceMeters><Track><Trackpoint><Time>2026-09-08T17:05:27Z</Time><Position><LatitudeDegrees>51.5</LatitudeDegrees><LongitudeDegrees>-0.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`
	_, _ = part.Write([]byte(tcx))
	_ = writer.Close()

	reqUpload := httptest.NewRequest(http.MethodPost, "/api/activities/upload", bytes.NewReader(body.Bytes()))
	reqUpload.Header.Set("Content-Type", writer.FormDataContentType())
	respUpload := httptest.NewRecorder()
	server.Handler.ServeHTTP(respUpload, reqUpload)

	if respUpload.Code != http.StatusOK {
		t.Fatalf("upload failed: %d, body: %s", respUpload.Code, respUpload.Body.String())
	}

	// Now list activities again
	reqList2 := httptest.NewRequest(http.MethodGet, "/api/activities", nil)
	respList2 := httptest.NewRecorder()
	server.Handler.ServeHTTP(respList2, reqList2)

	if respList2.Code != http.StatusOK || !strings.Contains(respList2.Body.String(), "test.tcx") {
		t.Fatalf("expected list to contain test.tcx, got %s", respList2.Body.String())
	}

	// Extract file ID from upload response or list response
	var listData struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	_ = json.Unmarshal(respList2.Body.Bytes(), &listData)
	if len(listData.Files) == 0 {
		t.Fatalf("expected at least 1 file in list response")
	}

	fileID := listData.Files[0].ID
	reqGet := httptest.NewRequest(http.MethodGet, "/api/activities/"+fileID, nil)
	respGet := httptest.NewRecorder()
	server.Handler.ServeHTTP(respGet, reqGet)

	if respGet.Code != http.StatusOK || !strings.Contains(respGet.Body.String(), "51.5") {
		t.Fatalf("expected get response to contain trackpoint lat 51.5, got %d: %s", respGet.Code, respGet.Body.String())
	}

	// Update metadata via PUT /api/activities/{id}
	updateBody := `{"name":"Updated Run Name","description":"Lovely morning run","tags":"running,morning"}`
	reqUpdate := httptest.NewRequest(http.MethodPut, "/api/activities/"+fileID, strings.NewReader(updateBody))
	reqUpdate.Header.Set("Content-Type", "application/json")
	respUpdate := httptest.NewRecorder()
	server.Handler.ServeHTTP(respUpdate, reqUpdate)

	if respUpdate.Code != http.StatusOK {
		t.Fatalf("expected PUT metadata status 200, got %d with body %s", respUpdate.Code, respUpdate.Body.String())
	}

	// Get specific file content again to check updated metadata
	reqGetUpdated := httptest.NewRequest(http.MethodGet, "/api/activities/"+fileID, nil)
	respGetUpdated := httptest.NewRecorder()
	server.Handler.ServeHTTP(respGetUpdated, reqGetUpdated)

	if respGetUpdated.Code != http.StatusOK || !strings.Contains(respGetUpdated.Body.String(), "Updated Run Name") {
		t.Fatalf("expected updated get response to contain 'Updated Run Name', got: %s", respGetUpdated.Body.String())
	}

	// Fetch dashboard stats via GET /api/dashboard
	reqDash := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	respDash := httptest.NewRecorder()
	server.Handler.ServeHTTP(respDash, reqDash)

	if respDash.Code != http.StatusOK || !strings.Contains(respDash.Body.String(), "totalDistance") || !strings.Contains(respDash.Body.String(), "trainingCount") {
		t.Fatalf("expected valid dashboard response, got %d: %s", respDash.Code, respDash.Body.String())
	}
}
