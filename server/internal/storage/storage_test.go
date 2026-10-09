package storage

import (
	"context"
	"testing"

	"github.com/tesfayecf/agon/server/internal/config"
)

func TestStorageUploadAndGetFallback(t *testing.T) {
	t.Parallel()

	cfg := config.S3Config{
		Endpoint:        "http://127.0.0.1:5500",
		Region:          "local",
		Bucket:          "test-bucket",
		AccessKeyID:     "test",
		SecretAccessKey: "test",
	}

	st, err := NewStorage(cfg)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	ctx := context.Background()
	key := "test/file.txt"
	data := []byte("hello storage test")

	if err := st.Upload(ctx, key, data, "text/plain"); err != nil {
		t.Fatalf("failed to upload: %v", err)
	}

	retrieved, err := st.Get(ctx, key)
	if err != nil {
		t.Fatalf("failed to get: %v", err)
	}

	if string(retrieved) != string(data) {
		t.Fatalf("expected %q, got %q", string(data), string(retrieved))
	}
}
