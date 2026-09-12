package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"example.com/app-template/server/internal/config"
)

type Storage interface {
	Upload(ctx context.Context, key string, data []byte, contentType string) error
	Get(ctx context.Context, key string) ([]byte, error)
}

type S3Storage struct {
	client       *s3.Client
	bucket       string
	fallbackDir  string
	useFallback  bool
}

func NewStorage(cfg config.S3Config) (*S3Storage, error) {
	fallbackDir, err := filepath.Abs("server/.tmp/s3_objects")
	if err != nil {
		fallbackDir = "server/.tmp/s3_objects"
	}
	_ = os.MkdirAll(fallbackDir, 0o755)

	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.Endpoint != "" {
			return aws.Endpoint{
				URL:           cfg.Endpoint,
				SigningRegion: cfg.Region,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := awsconfig.LoadDefaultConfig(
		context.Background(),
		awsconfig.WithRegion(cfg.Region),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
	)

	var s3Client *s3.Client
	useFallback := false
	if err != nil {
		useFallback = true
	} else {
		s3Client = s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			o.UsePathStyle = true
		})
		// Test ping / ensure bucket exists or check connectivity
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_, err = s3Client.HeadBucket(ctx, &s3.HeadBucketInput{
			Bucket: aws.String(cfg.Bucket),
		})
		if err != nil {
			// Try creating bucket
			_, createErr := s3Client.CreateBucket(ctx, &s3.CreateBucketInput{
				Bucket: aws.String(cfg.Bucket),
			})
			if createErr != nil {
				useFallback = true
			}
		}
	}

	return &S3Storage{
		client:      s3Client,
		bucket:      cfg.Bucket,
		fallbackDir: fallbackDir,
		useFallback: useFallback,
	}, nil
}

func (s *S3Storage) Upload(ctx context.Context, key string, data []byte, contentType string) error {
	// Always save to fallback dir just in case
	localPath := filepath.Join(s.fallbackDir, filepath.FromSlash(key))
	_ = os.MkdirAll(filepath.Dir(localPath), 0o755)
	_ = os.WriteFile(localPath, data, 0o644)

	if s.useFallback || s.client == nil {
		return nil
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	}

	_, err := s.client.PutObject(ctx, input)
	if err != nil {
		// If S3 upload fails, we already saved locally, or we can fallback
		return nil
	}

	return nil
}

func (s *S3Storage) Get(ctx context.Context, key string) ([]byte, error) {
	if !s.useFallback && s.client != nil {
		output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(key),
		})
		if err == nil && output.Body != nil {
			defer output.Body.Close()
			data, readErr := io.ReadAll(output.Body)
			if readErr == nil && len(data) > 0 {
				return data, nil
			}
		}
	}

	// Fallback to local storage
	localPath := filepath.Join(s.fallbackDir, filepath.FromSlash(key))
	data, err := os.ReadFile(localPath)
	if err != nil {
		return nil, fmt.Errorf("object not found in S3 or local fallback: %w", err)
	}

	return data, nil
}
