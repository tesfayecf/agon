package activities

import (
	"os"
	"testing"
)

// TestParseFITFileAppliesFitScaleFactors guards against a regression where the FIT
// session's total_elapsed_time (scale 1000, seconds) and total_distance (scale 100,
// meters) were read as raw integers instead of being divided by their scale factor.
func TestParseFITFileAppliesFitScaleFactors(t *testing.T) {
	t.Parallel()

	payload, err := os.ReadFile("../../../docs/examples/test1.fit")
	if err != nil {
		t.Skipf("fixture not available: %v", err)
	}

	result, err := ParseUploadFile("test1.fit", payload)
	if err != nil {
		t.Fatalf("ParseUploadFile returned error: %v", err)
	}

	if result.Status != "success" {
		t.Fatalf("expected successful parse, got status %q (%s)", result.Status, result.Error)
	}

	if result.DurationSeconds <= 0 || result.DurationSeconds > 24*3600 {
		t.Fatalf("expected duration in a plausible range (0, 86400] seconds, got %f", result.DurationSeconds)
	}

	if result.DistanceMeters <= 0 || result.DistanceMeters > 200_000 {
		t.Fatalf("expected distance in a plausible range (0, 200000] meters, got %f", result.DistanceMeters)
	}
}
