package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

type HTTPConfig struct {
	Address           string
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
}

type S3Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
}

type Config struct {
	AppEnv         string
	AllowedOrigins []string
	Database       DatabaseConfig
	HTTP           HTTPConfig
	S3             S3Config
}

type DatabaseConfig struct {
	BackupDir string
	Enabled   bool
	Path      string
}

func Load() (Config, error) {
	databasePath := getEnv("SQLITE_PATH", "server/.tmp/app.db")
	readHeaderTimeout, err := getDuration("HTTP_READ_HEADER_TIMEOUT", 5*time.Second)
	if err != nil {
		return Config{}, err
	}

	readTimeout, err := getDuration("HTTP_READ_TIMEOUT", 15*time.Second)
	if err != nil {
		return Config{}, err
	}

	writeTimeout, err := getDuration("HTTP_WRITE_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}

	idleTimeout, err := getDuration("HTTP_IDLE_TIMEOUT", time.Minute)
	if err != nil {
		return Config{}, err
	}

	return Config{
		AppEnv:         getEnv("APP_ENV", "development"),
		AllowedOrigins: getList("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
		Database: DatabaseConfig{
			BackupDir: getEnv("SQLITE_BACKUP_DIR", "server/.tmp/backups"),
			Enabled:   databasePath != "",
			Path:      databasePath,
		},
		HTTP: HTTPConfig{
			Address:           getEnv("HTTP_ADDR", ":8080"),
			ReadHeaderTimeout: readHeaderTimeout,
			ReadTimeout:       readTimeout,
			WriteTimeout:      writeTimeout,
			IdleTimeout:       idleTimeout,
		},
		S3: S3Config{
			Endpoint:        getEnv("S3_ENDPOINT", "http://127.0.0.1:5500"),
			Region:          getEnv("S3_REGION", "local"),
			Bucket:          getEnv("S3_BUCKET", "agon-files"),
			AccessKeyID:     getEnv("S3_ACCESS_KEY_ID", "local-dev"),
			SecretAccessKey: getEnv("S3_SECRET_ACCESS_KEY", "local-dev"),
		},
	}, nil
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func getDuration(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}

	return parsed, nil
}

func getList(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parts := strings.Split(value, ",")
	values := make([]string, 0, len(parts))

	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}

		values = append(values, trimmed)
	}

	if len(values) == 0 {
		return fallback
	}

	return values
}
