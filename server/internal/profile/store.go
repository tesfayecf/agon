// Package profile stores the athlete's physical metrics (height, weight, age, heart-rate
// bounds). It is a single-row table because the application is single-user.
package profile

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"
)

// Sex values. Empty means "not specified".
const (
	SexMale   = "male"
	SexFemale = "female"
)

// ErrInvalidProfile wraps every validation failure so handlers can map it to 400.
var ErrInvalidProfile = errors.New("invalid profile")

// Profile holds the user-entered physical metrics. A zero value (or empty string) means
// the metric has not been provided.
type Profile struct {
	HeightCm         float64 `json:"heightCm"`
	WeightKg         float64 `json:"weightKg"`
	BirthDate        string  `json:"birthDate"` // YYYY-MM-DD
	Sex              string  `json:"sex"`
	RestingHeartRate float64 `json:"restingHeartRate"`
	MaxHeartRate     float64 `json:"maxHeartRate"`
	UpdatedAt        string  `json:"updatedAt,omitempty"`
}

// Derived holds values computed from a Profile. Zero means "not computable".
type Derived struct {
	AgeYears              int     `json:"ageYears"`
	BMI                   float64 `json:"bmi"`
	EstimatedMaxHeartRate float64 `json:"estimatedMaxHeartRate"`
	HeartRateReserve      float64 `json:"heartRateReserve"`
}

// WithDerived is the API representation of the profile.
type WithDerived struct {
	Profile
	Derived Derived `json:"derived"`
}

// Validate checks every provided metric against a plausible human range.
func (p Profile) Validate(now time.Time) error {
	if p.HeightCm != 0 && (p.HeightCm < 100 || p.HeightCm > 250) {
		return fmt.Errorf("%w: heightCm must be between 100 and 250", ErrInvalidProfile)
	}
	if p.WeightKg != 0 && (p.WeightKg < 30 || p.WeightKg > 250) {
		return fmt.Errorf("%w: weightKg must be between 30 and 250", ErrInvalidProfile)
	}
	if p.BirthDate != "" {
		birth, err := time.Parse("2006-01-02", p.BirthDate)
		if err != nil {
			return fmt.Errorf("%w: birthDate must be YYYY-MM-DD", ErrInvalidProfile)
		}
		if age := ageAt(birth, now); age < 5 || age > 110 {
			return fmt.Errorf("%w: birthDate gives an implausible age", ErrInvalidProfile)
		}
	}
	if p.Sex != "" && p.Sex != SexMale && p.Sex != SexFemale {
		return fmt.Errorf("%w: sex must be male, female or empty", ErrInvalidProfile)
	}
	if p.RestingHeartRate != 0 && (p.RestingHeartRate < 25 || p.RestingHeartRate > 120) {
		return fmt.Errorf("%w: restingHeartRate must be between 25 and 120", ErrInvalidProfile)
	}
	if p.MaxHeartRate != 0 && (p.MaxHeartRate < 100 || p.MaxHeartRate > 230) {
		return fmt.Errorf("%w: maxHeartRate must be between 100 and 230", ErrInvalidProfile)
	}
	if p.RestingHeartRate != 0 && p.MaxHeartRate != 0 && p.MaxHeartRate <= p.RestingHeartRate {
		return fmt.Errorf("%w: maxHeartRate must be above restingHeartRate", ErrInvalidProfile)
	}
	return nil
}

// Derive computes age, BMI and heart-rate figures from whatever metrics are present.
func (p Profile) Derive(now time.Time) Derived {
	var d Derived
	if birth, err := time.Parse("2006-01-02", p.BirthDate); err == nil {
		d.AgeYears = ageAt(birth, now)
		// Tanaka et al. (2001): 208 − 0.7 × age, a better population fit than 220 − age.
		d.EstimatedMaxHeartRate = math.Round(208 - 0.7*float64(d.AgeYears))
	}
	if p.HeightCm > 0 && p.WeightKg > 0 {
		m := p.HeightCm / 100
		d.BMI = math.Round(p.WeightKg/(m*m)*10) / 10
	}
	if p.RestingHeartRate > 0 && p.MaxHeartRate > p.RestingHeartRate {
		d.HeartRateReserve = p.MaxHeartRate - p.RestingHeartRate
	}
	return d
}

func ageAt(birth, now time.Time) int {
	age := now.Year() - birth.Year()
	if now.Month() < birth.Month() || (now.Month() == birth.Month() && now.Day() < birth.Day()) {
		age--
	}
	return age
}

func EnsureTables(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS athlete_profile (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		height_cm REAL,
		weight_kg REAL,
		birth_date TEXT,
		sex TEXT,
		resting_heart_rate REAL,
		max_heart_rate REAL,
		updated_at TEXT NOT NULL
	);`)
	if err != nil {
		return fmt.Errorf("ensure profile table: %w", err)
	}
	return nil
}

// Get returns the stored profile, or an empty profile when none has been saved.
func Get(ctx context.Context, db *sql.DB) (Profile, error) {
	if db == nil {
		return Profile{}, nil
	}
	var p Profile
	err := db.QueryRowContext(ctx,
		`SELECT COALESCE(height_cm, 0), COALESCE(weight_kg, 0), COALESCE(birth_date, ''), COALESCE(sex, ''),
			COALESCE(resting_heart_rate, 0), COALESCE(max_heart_rate, 0), updated_at
		FROM athlete_profile WHERE id = 1`,
	).Scan(&p.HeightCm, &p.WeightKg, &p.BirthDate, &p.Sex, &p.RestingHeartRate, &p.MaxHeartRate, &p.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Profile{}, nil
	}
	if err != nil {
		return Profile{}, fmt.Errorf("get profile: %w", err)
	}
	return p, nil
}

// Save replaces the stored profile.
func Save(ctx context.Context, db *sql.DB, p Profile) (Profile, error) {
	p.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	_, err := db.ExecContext(ctx,
		`INSERT INTO athlete_profile (id, height_cm, weight_kg, birth_date, sex, resting_heart_rate, max_heart_rate, updated_at)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			height_cm = excluded.height_cm,
			weight_kg = excluded.weight_kg,
			birth_date = excluded.birth_date,
			sex = excluded.sex,
			resting_heart_rate = excluded.resting_heart_rate,
			max_heart_rate = excluded.max_heart_rate,
			updated_at = excluded.updated_at`,
		p.HeightCm, p.WeightKg, p.BirthDate, p.Sex, p.RestingHeartRate, p.MaxHeartRate, p.UpdatedAt,
	)
	if err != nil {
		return Profile{}, fmt.Errorf("save profile: %w", err)
	}
	return p, nil
}
