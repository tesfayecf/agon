// Package mcp handler — registers application-specific MCP resources and tools.
// Resources expose training data for AI models to read; tools let AI models
// generate training plans, create goals, and manage the weekly schedule.
package mcp

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/tesfayecf/agon/server/internal/activities"
	"github.com/tesfayecf/agon/server/internal/planning"
	"github.com/tesfayecf/agon/server/internal/storage"
	"github.com/tesfayecf/agon/server/internal/trainingplan"
)

// ResourceProvider resolves MCP resource URIs and returns contents.
type ResourceProvider interface {
	List(ctx context.Context) []MCPResource
	Read(ctx context.Context, uri string) (string, error)
}

// ToolProvider provides MCP tool definitions and handles tool calls.
type ToolProvider interface {
	List(ctx context.Context) []MCPTool
	Call(ctx context.Context, name string, argsJSON string) ([]MCPToolContentPart, error)
}

// --- Tool argument structs (decoded from JSON) ---

type GeneratePlanArgs struct {
	Title       string                       `json:"title"`
	Description string                       `json:"description,omitempty"`
	Reasoning   string                       `json:"reasoning,omitempty"`
	WeekCount   int                          `json:"weekCount"`
	StartDate   string                       `json:"startDate,omitempty"`
	Sessions    []GeneratePlanSessionArg     `json:"sessions"`
}

type GeneratePlanSessionArg struct {
	WeekNumber          int     `json:"weekNumber"`
	DayOfWeek           int     `json:"dayOfWeek"`
	Date                string  `json:"date,omitempty"`
	TrainingType        string  `json:"trainingType,omitempty"`
	Title               string  `json:"title,omitempty"`
	Description         string  `json:"description,omitempty"`
	TargetDistanceMeters float64 `json:"targetDistanceMeters,omitempty"`
	TargetDurationSecs   float64 `json:"targetDurationSeconds,omitempty"`
	TargetPaceSecPerKm   float64 `json:"targetPaceSecondsPerKm,omitempty"`
	TargetHeartRateMin   float64 `json:"targetHeartRateMin,omitempty"`
	TargetHeartRateMax   float64 `json:"targetHeartRateMax,omitempty"`
	Intensity            string `json:"intensity,omitempty"`
	Notes               string `json:"notes,omitempty"`
}

type CreateGoalArgs struct {
	Type         string  `json:"type"`
	TargetMeters float64 `json:"targetMeters"`
}

type CreatePlannedSessionArgs struct {
	Date                string  `json:"date"`
	TrainingType        string  `json:"trainingType,omitempty"`
	Title               string  `json:"title,omitempty"`
	TargetDistanceMeters float64 `json:"targetDistanceMeters,omitempty"`
	TargetDurationSecs   float64 `json:"targetDurationSeconds,omitempty"`
	TargetPaceSecPerKm   float64 `json:"targetPaceSecondsPerKm,omitempty"`
	Notes               string `json:"notes,omitempty"`
}

type UpdateTemplateDayArg struct {
	DayOfWeek            int     `json:"dayOfWeek"`
	TrainingType         string  `json:"trainingType,omitempty"`
	Title                string  `json:"title,omitempty"`
	TargetDistanceMeters float64 `json:"targetDistanceMeters,omitempty"`
	TargetDurationSecs   float64 `json:"targetDurationSeconds,omitempty"`
	TargetPaceSecPerKm   float64 `json:"targetPaceSecondsPerKm,omitempty"`
	Notes                string  `json:"notes,omitempty"`
}

type UpdateTemplateArgs struct {
	Days []UpdateTemplateDayArg `json:"days"`
}

type UpdatePlanStatusArgs struct {
	PlanID string `json:"planId"`
	Status string `json:"status"`
}

type SetActivityWorkoutArgs struct {
	ActivityID  string                `json:"activityId"`
	WorkoutType string                `json:"workoutType"`
	Intervals   []activities.Interval `json:"intervals,omitempty"`
}

// --- AgonResourceProvider ---

type AgonResourceProvider struct {
	db    *sql.DB
	store storage.Storage
}

func NewAgonResourceProvider(db *sql.DB, store storage.Storage) *AgonResourceProvider {
	return &AgonResourceProvider{db: db, store: store}
}

func (p *AgonResourceProvider) List(ctx context.Context) []MCPResource {
	resources := []MCPResource{
		MCPResource{URI: "agon://activities", Name: "Training Sessions", Description: "List of all uploaded training sessions with summary metrics", MIMEType: "application/json"},
		MCPResource{URI: "agon://analytics/summary", Name: "Analytics Summary", Description: "Dashboard-style aggregated analytics: totals, trends, personal bests, goals progress", MIMEType: "application/json"},
		MCPResource{URI: "agon://analytics/weekly-trend", Name: "Weekly Distance Trend", Description: "Weekly training volume trend for the last 12 weeks", MIMEType: "application/json"},
		MCPResource{URI: "agon://analytics/monthly-trend", Name: "Monthly Distance Trend", Description: "Monthly training volume trend for the last 12 months", MIMEType: "application/json"},
		MCPResource{URI: "agon://analytics/personal-bests", Name: "Personal Bests", Description: "Personal best performances by distance", MIMEType: "application/json"},
		MCPResource{URI: "agon://goals", Name: "Training Goals", Description: "Active training goals with current progress", MIMEType: "application/json"},
		MCPResource{URI: "agon://schedule/template", Name: "Weekly Schedule Template", Description: "Reusable weekly training schedule template", MIMEType: "application/json"},
		MCPResource{URI: "agon://schedule/planned", Name: "Planned Sessions", Description: "All manually planned training sessions", MIMEType: "application/json"},
		MCPResource{URI: "agon://training-plans", Name: "AI Training Plans", Description: "AI-generated multi-week training plans", MIMEType: "application/json"},
		MCPResource{URI: "agon://activities/{id}", Name: "Training Session Detail", Description: "Detailed records for a specific training session by ID", MIMEType: "application/json"},
		MCPResource{URI: "agon://activities/{id}/workout", Name: "Training Workout", Description: "Workout type and interval segments (with derived time range, distance, pace and heart rate) of a training, without the track records", MIMEType: "application/json"},
		MCPResource{URI: "agon://training-plans/{id}", Name: "Training Plan Detail", Description: "A specific AI-generated training plan with all its sessions", MIMEType: "application/json"},
	}
	return resources
}

func (p *AgonResourceProvider) Read(ctx context.Context, uri string) (string, error) {
	uriPath := uri
	queryParams := make(map[string]string)
	if qIdx := strings.Index(uri, "?"); qIdx >= 0 {
		uriPath = uri[:qIdx]
		qs := uri[qIdx + 1:]
		for _, pair := range strings.Split(qs, "&") {
			if eqIdx := strings.Index(pair, "="); eqIdx >= 0 {
				key := pair[:eqIdx]
				val := pair[eqIdx + 1:]
				if key != "" && val != "" {
					queryParams[key] = val
				}
			}
		}
	}

	switch uriPath {
	case "agon://activities":
		return p.readActivities(ctx)
	case "agon://analytics/summary":
		return p.readAnalyticsSummary(ctx)
	case "agon://analytics/weekly-trend":
		weeks := 12
		if w := queryParams["weeks"]; w != "" {
			if parsed, err := strconv.Atoi(w); err == nil && parsed > 0 {
				weeks = parsed
			}
		}
		return p.readWeeklyTrend(ctx, weeks)
	case "agon://analytics/monthly-trend":
		months := 12
		if m := queryParams["months"]; m != "" {
			if parsed, err := strconv.Atoi(m); err == nil && parsed > 0 {
				months = parsed
			}
		}
		return p.readMonthlyTrend(ctx, months)
	case "agon://analytics/personal-bests":
		return p.readPersonalBests(ctx)
	case "agon://goals":
		return p.readGoals(ctx)
	case "agon://schedule/template":
		return p.readScheduleTemplate(ctx)
	case "agon://schedule/planned":
		return p.readPlannedSessions(ctx)
	case "agon://training-plans":
		return p.readTrainingPlans(ctx)
	default:
		if strings.HasPrefix(uriPath, "agon://activities/") {
			id := strings.TrimPrefix(uriPath, "agon://activities/")
			if workoutID, ok := strings.CutSuffix(id, "/workout"); ok && workoutID != "" {
				return p.readActivityWorkout(ctx, workoutID)
			}
			if id != "" {
				return p.readActivity(ctx, id)
			}
		}
		if strings.HasPrefix(uriPath, "agon://training-plans/") {
			id := strings.TrimPrefix(uriPath, "agon://training-plans/")
			if id != "" {
				return p.readTrainingPlan(ctx, id)
			}
		}
		return "", fmt.Errorf("resource not found: %s", uri)
	}
}

func (p *AgonResourceProvider) readActivities(ctx context.Context) (string, error) {
	records, err := activities.ListFileRecords(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("list activities: %w", err)
	}
	type ActivitySummary struct {
		ID              string  `json:"id"`
		Name            string  `json:"name"`
		Date            string  `json:"date"`
		Type            string  `json:"type"`
		DistanceMeters  float64 `json:"distanceMeters"`
		DurationSeconds float64 `json:"durationSeconds"`
		AvgHeartRate    float64 `json:"avgHeartRate"`
		ElevationGain   float64 `json:"elevationGain"`
		Tags            string  `json:"tags"`
		WorkoutType     string  `json:"workoutType,omitempty"`
		WorkIntervals   int     `json:"workIntervals,omitempty"`
	}
	summaries := make([]ActivitySummary, 0, len(records))
	for _, r := range records {
		if r.Status == "success" {
			summaries = append(summaries, ActivitySummary{
				ID:              r.ID,
				Name:            r.Name,
				Date:            r.ActivityDate,
				Type:            r.FileType,
				DistanceMeters:  r.DistanceMeters,
				DurationSeconds: r.DurationSeconds,
				AvgHeartRate:    r.AvgHeartRate,
				ElevationGain:   r.ElevationGain,
				Tags:            r.Tags,
				WorkoutType:     r.WorkoutType,
				WorkIntervals:   countWork(r.Intervals),
			})
		}
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(map[string]any{
		"count":      len(summaries),
		"activities": summaries,
	})
	return buf.String(), nil
}

func (p *AgonResourceProvider) readActivity(ctx context.Context, id string) (string, error) {
	rec, err := activities.GetFileRecord(ctx, p.db, id)
	if err != nil {
		return "", fmt.Errorf("activity not found: %w", err)
	}
	if p.store == nil {
		buf := strings.Builder{}
		_ = json.NewEncoder(&buf).Encode(rec)
		return buf.String(), nil
	}
	payload, err := p.store.Get(ctx, rec.S3Key)
	if err != nil {
		return "", fmt.Errorf("read activity payload: %w", err)
	}
	parsed, parseErr := activities.ParseUploadFile(rec.Filename, payload)
	if parseErr != nil {
		return fmt.Sprintf(`{"id":"%s","filename":"%s","status":"error","error":"%s"}`, rec.ID, rec.Filename, parseErr.Error()), nil
	}
	parsed.ID = rec.ID
	parsed.Name = rec.Name
	parsed.Description = rec.Description
	parsed.Tags = rec.Tags
	parsed.WorkoutType = rec.WorkoutType
	parsed.Intervals = rec.Intervals
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(parsed)
	return buf.String(), nil
}

func (p *AgonResourceProvider) readActivityWorkout(ctx context.Context, id string) (string, error) {
	rec, err := activities.GetFileRecord(ctx, p.db, id)
	if err != nil {
		return "", fmt.Errorf("activity not found: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(map[string]any{
		"id":          rec.ID,
		"name":        rec.Name,
		"workoutType": rec.WorkoutType,
		"intervals":   rec.Intervals,
	})
	return buf.String(), nil
}

func (p *AgonResourceProvider) readAnalyticsSummary(ctx context.Context) (string, error) {
	records, err := activities.ListFileRecords(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("list records: %w", err)
	}
	now := time.Now()
	wd, _ := activities.CurrentWeekDistance(records, now)
	md, _ := activities.CurrentMonthDistance(records, now)
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(map[string]any{
		"totalDistance":   activities.TotalDistance(records),
		"totalDuration":   activities.TotalDuration(records),
		"trainingCount":   len(records),
		"weeklyDistance":  wd,
		"monthlyDistance": md,
		"weeklyTrend":     activities.WeeklyTrend(records, 8, now),
		"monthlyTrend":    activities.MonthlyTrend(records, 6, now),
		"paceTrend":       activities.PaceTrend(records, 8, now),
		"heartRateTrend":  activities.HeartRateTrend(records, 8, now),
		"personalBests":   activities.PersonalBests(records),
		"trainingLoad":    activities.ComputeTrainingLoad(records, now),
	})
	return buf.String(), nil
}

func (p *AgonResourceProvider) readWeeklyTrend(ctx context.Context, weeks int) (string, error) {
	records, err := activities.ListFileRecords(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("list records: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(activities.WeeklyTrend(records, weeks, time.Now()))
	return buf.String(), nil
}

func (p *AgonResourceProvider) readMonthlyTrend(ctx context.Context, months int) (string, error) {
	records, err := activities.ListFileRecords(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("list records: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(activities.MonthlyTrend(records, months, time.Now()))
	return buf.String(), nil
}

func (p *AgonResourceProvider) readPersonalBests(ctx context.Context) (string, error) {
	records, err := activities.ListFileRecords(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("list records: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(activities.PersonalBests(records))
	return buf.String(), nil
}

func (p *AgonResourceProvider) readGoals(ctx context.Context) (string, error) {
	if p.db == nil {
		return "[]", nil
	}
	goals, err := planning.ListGoals(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("list goals: %w", err)
	}
	records, _ := activities.ListFileRecords(ctx, p.db)
	result := make([]map[string]any, 0, len(goals))
	for _, g := range goals {
		var achieved float64
		switch g.Type {
		case planning.GoalTypeMonthlyDistance:
			achieved, _ = activities.CurrentMonthDistance(records, time.Now())
		default:
			achieved, _ = activities.CurrentWeekDistance(records, time.Now())
		}
		result = append(result, map[string]any{
			"id":              g.ID,
			"type":            g.Type,
			"targetMeters":    g.TargetMeters,
			"achievedMeters":  achieved,
			"active":          g.Active,
			"percentComplete": achieved / g.TargetMeters * 100,
		})
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(result)
	return buf.String(), nil
}

func (p *AgonResourceProvider) readScheduleTemplate(ctx context.Context) (string, error) {
	if p.db == nil {
		return "[]", nil
	}
	slots, err := planning.GetTemplate(ctx, p.db)
	if err != nil {
		return "", fmt.Errorf("get schedule template: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(slots)
	return buf.String(), nil
}

func (p *AgonResourceProvider) readPlannedSessions(ctx context.Context) (string, error) {
	if p.db == nil {
		return "[]", nil
	}
	sessions, err := planning.ListPlannedSessionsInRange(ctx, p.db, "2000-01-01", "2099-12-31")
	if err != nil {
		return "", fmt.Errorf("list planned sessions: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(sessions)
	return buf.String(), nil
}

func (p *AgonResourceProvider) readTrainingPlans(ctx context.Context) (string, error) {
	if p.db == nil {
		return "[]", nil
	}
	plans, err := trainingplan.ListPlans(ctx, p.db, "")
	if err != nil {
		return "", fmt.Errorf("list training plans: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(plans)
	return buf.String(), nil
}

func (p *AgonResourceProvider) readTrainingPlan(ctx context.Context, id string) (string, error) {
	if p.db == nil {
		return "", fmt.Errorf("database not available")
	}
	plan, sessions, err := trainingplan.GetPlan(ctx, p.db, id)
	if err != nil {
		return "", fmt.Errorf("get training plan: %w", err)
	}
	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(map[string]any{
		"plan":     plan,
		"sessions": sessions,
	})
	return buf.String(), nil
}

// --- AgonToolProvider ---

type AgonToolProvider struct {
	db    *sql.DB
	store storage.Storage
}

func NewAgonToolProvider(db *sql.DB, store storage.Storage) *AgonToolProvider {
	return &AgonToolProvider{db: db, store: store}
}

func (p *AgonToolProvider) List(ctx context.Context) []MCPTool {
	return []MCPTool{
		MCPTool{
			Name: "generate_training_plan",
			Description: "Generate a multi-week training plan based on analysis of past training sessions. Returns the created plan with all sessions.",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title": map[string]any{"type": "string", "description": "Title for this training plan"},
					"description": map[string]any{"type": "string", "description": "Description of the plan's purpose and approach (supports Markdown)"},
					"reasoning": map[string]any{"type": "string", "description": "AI reasoning — analysis of past training and rationale for this plan"},
					"weekCount": map[string]any{"type": "integer", "description": "Number of weeks this plan covers (1-16)", "minimum": 1, "maximum": 16},
					"startDate": map[string]any{"type": "string", "description": "Start date of the plan (YYYY-MM-DD)"},
					"sessions": map[string]any{
						"type": "array",
						"description": "Array of training sessions in the plan",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"weekNumber": map[string]any{"type": "integer", "description": "1-based week number"},
								"dayOfWeek": map[string]any{"type": "integer", "description": "0=Monday .. 6=Sunday"},
								"date": map[string]any{"type": "string", "description": "Date YYYY-MM-DD (optional)"},
								"trainingType": map[string]any{"type": "string", "description": "e.g. run, bike, swim, rest, strength"},
								"title": map[string]any{"type": "string", "description": "Short session title"},
								"description": map[string]any{"type": "string", "description": "Detailed session description (supports Markdown)"},
								"targetDistanceMeters": map[string]any{"type": "number", "description": "Target distance in meters"},
								"targetDurationSeconds": map[string]any{"type": "number", "description": "Target duration in seconds"},
								"targetPaceSecondsPerKm": map[string]any{"type": "number", "description": "Target pace in sec/km"},
								"targetHeartRateMin": map[string]any{"type": "number", "description": "Minimum target heart rate"},
								"targetHeartRateMax": map[string]any{"type": "number", "description": "Maximum target heart rate"},
								"intensity": map[string]any{"type": "string", "description": "easy | moderate | hard | recovery"},
								"notes": map[string]any{"type": "string", "description": "Coach notes or instructions"},
							},
							"required": []string{"weekNumber", "dayOfWeek"},
						},
					},
				},
				"required": []string{"title", "weekCount", "sessions"},
			},
		},
		MCPTool{
			Name: "create_goal",
			Description: "Create a new training goal (weekly or monthly distance target).",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"type": map[string]any{"type": "string", "description": "weekly_distance or monthly_distance", "enum": []string{"weekly_distance", "monthly_distance"}},
					"targetMeters": map[string]any{"type": "number", "description": "Target distance in meters"},
				},
				"required": []string{"type", "targetMeters"},
			},
		},
		MCPTool{
			Name: "create_planned_session",
			Description: "Add a single planned training session on a specific date.",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"date": map[string]any{"type": "string", "description": "Date YYYY-MM-DD"},
					"trainingType": map[string]any{"type": "string", "description": "e.g. run, bike, swim, rest"},
					"title": map[string]any{"type": "string", "description": "Session title"},
					"targetDistanceMeters": map[string]any{"type": "number", "description": "Target distance in meters"},
					"targetDurationSeconds": map[string]any{"type": "number", "description": "Target duration in seconds"},
					"targetPaceSecondsPerKm": map[string]any{"type": "number", "description": "Target pace in sec/km"},
					"notes": map[string]any{"type": "string", "description": "Notes or instructions"},
				},
				"required": []string{"date"},
			},
		},
		MCPTool{
			Name: "update_schedule_template",
			Description: "Replace the reusable weekly schedule template (one slot per day of week, Monday=0..Sunday=6).",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"days": map[string]any{
						"type": "array",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"dayOfWeek": map[string]any{"type": "integer", "description": "0=Monday .. 6=Sunday"},
								"trainingType": map[string]any{"type": "string"},
								"title": map[string]any{"type": "string"},
								"targetDistanceMeters": map[string]any{"type": "number"},
								"targetDurationSeconds": map[string]any{"type": "number"},
								"targetPaceSecondsPerKm": map[string]any{"type": "number"},
								"notes": map[string]any{"type": "string"},
							},
							"required": []string{"dayOfWeek"},
						},
					},
				},
				"required": []string{"days"},
			},
		},
		MCPTool{
			Name: "update_plan_status",
			Description: "Update the status of an AI-generated training plan (draft -> active -> archived).",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"planId": map[string]any{"type": "string", "description": "The training plan ID"},
					"status": map[string]any{"type": "string", "description": "New status: draft | active | archived", "enum": []string{"draft", "active", "archived"}},
				},
				"required": []string{"planId", "status"},
			},
		},
		MCPTool{
			Name:        "set_activity_workout",
			Description: "Mark a training's workout type and, for interval trainings, replace the full list of interval segments (read the current ones from agon://activities/{id}/workout first if you only want to change some). Each interval is given by a start and a length, either in time (seconds from the start of the training) or in distance (meters from the start). The server derives each interval's time range, distance, average pace and heart rate from the pace/heart-rate profile. Intervals must not overlap. Pass an empty workoutType to clear the workout.",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"activityId":  map[string]any{"type": "string", "description": "Training ID (from agon://activities)"},
					"workoutType": map[string]any{"type": "string", "description": "Workout type", "enum": []string{"", "easy", "long", "tempo", "hills", "intervals", "race", "other"}},
					"intervals": map[string]any{
						"type":        "array",
						"description": "Interval segments (only when workoutType is intervals)",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"kind":   map[string]any{"type": "string", "enum": []string{"warmup", "work", "recovery", "cooldown"}},
								"basis":  map[string]any{"type": "string", "enum": []string{"time", "distance"}, "description": "Unit of start and length: time = seconds, distance = meters. Defaults to time."},
								"start":  map[string]any{"type": "number", "description": "Seconds (basis time) or meters (basis distance) from the start of the training"},
								"length": map[string]any{"type": "number", "description": "Duration in seconds (basis time) or length in meters (basis distance); must be > 0"},
								"label":  map[string]any{"type": "string", "description": "Optional label, e.g. 'Rep 1' or '400 m'"},
							},
							"required": []string{"kind", "start", "length"},
						},
					},
				},
				"required": []string{"activityId", "workoutType"},
			},
		},
	}
}

func (p *AgonToolProvider) Call(ctx context.Context, name string, argsJSON string) ([]MCPToolContentPart, error) {
	// Each tool decodes its arguments from the JSON string into a concrete struct.
	switch name {
	case "generate_training_plan":
		return p.callGeneratePlan(ctx, argsJSON)
	case "create_goal":
		return p.callCreateGoal(ctx, argsJSON)
	case "create_planned_session":
		return p.callCreatePlannedSession(ctx, argsJSON)
	case "update_schedule_template":
		return p.callUpdateTemplate(ctx, argsJSON)
	case "update_plan_status":
		return p.callUpdatePlanStatus(ctx, argsJSON)
	case "set_activity_workout":
		return p.callSetActivityWorkout(ctx, argsJSON)
	default:
		return nil, fmt.Errorf("tool not found: %s", name)
	}
}

func makeContent(text string) ([]MCPToolContentPart, error) {
	return []MCPToolContentPart{NewTextContent(text)}, nil
}

func (p *AgonToolProvider) callGeneratePlan(ctx context.Context, argsJSON string) ([]MCPToolContentPart, error) {
	if p.db == nil {
		return makeContent("Database not available")
	}

	var args GeneratePlanArgs
	dec := json.NewDecoder(strings.NewReader(argsJSON))
	if err := dec.Decode(&args); err != nil {
		return makeContent(fmt.Sprintf("Invalid arguments: %v", err))
	}

	if args.Title == "" {
		return makeContent("title is required")
	}
	if args.WeekCount < 1 || args.WeekCount > 16 {
		args.WeekCount = 4
	}
	if len(args.Sessions) == 0 {
		return makeContent("At least one session is required")
	}

	sessions := make([]trainingplan.TrainingPlanSession, 0, len(args.Sessions))
	for i, s := range args.Sessions {
		wn := s.WeekNumber
		if wn < 1 {
			wn = 1
		}
		sessions = append(sessions, trainingplan.TrainingPlanSession{
			ID:                   fmt.Sprintf("tps-%d-%d", time.Now().UnixNano(), i),
			WeekNumber:           wn,
			DayOfWeek:            s.DayOfWeek,
			Date:                 s.Date,
			TrainingType:         s.TrainingType,
			Title:                s.Title,
			Description:          s.Description,
			TargetDistanceMeters: s.TargetDistanceMeters,
			TargetDurationSecs:   s.TargetDurationSecs,
			TargetPaceSecPerKm:   s.TargetPaceSecPerKm,
			TargetHeartRateMin:   s.TargetHeartRateMin,
			TargetHeartRateMax:   s.TargetHeartRateMax,
			Intensity:            s.Intensity,
			SortOrder:            i,
			Notes:                s.Notes,
		})
	}

	endDate := ""
	if args.StartDate != "" {
		if start, err := time.Parse("2006-01-02", args.StartDate); err == nil {
			end := start.AddDate(0, 0, 7 * args.WeekCount - 1)
			endDate = end.Format("2006-01-02")
		}
	}

	plan := trainingplan.TrainingPlan{
		ID:        fmt.Sprintf("plan-%d", time.Now().UnixNano()),
		Title:     args.Title,
		Description: args.Description,
		Reasoning: args.Reasoning,
		GenerationParams: trainingplan.GenerationParams{
			Model:    "mcp-ai-model",
			Provider: "mcp",
		},
		WeekCount: args.WeekCount,
		StartDate: args.StartDate,
		EndDate:   endDate,
		Status:    trainingplan.PlanStatusDraft,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if err := trainingplan.InsertPlan(ctx, p.db, plan, sessions); err != nil {
		return makeContent(fmt.Sprintf("Failed to store plan: %v", err))
	}

	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(map[string]any{
		"plan":     plan,
		"sessions": sessions,
	})
	return makeContent(fmt.Sprintf("Training plan created successfully.\n\n%s", buf.String()))
}

func (p *AgonToolProvider) callCreateGoal(ctx context.Context, argsJSON string) ([]MCPToolContentPart, error) {
	if p.db == nil {
		return makeContent("Database not available")
	}

	var args CreateGoalArgs
	dec := json.NewDecoder(strings.NewReader(argsJSON))
	if err := dec.Decode(&args); err != nil {
		return makeContent(fmt.Sprintf("Invalid arguments: %v", err))
	}

	if args.Type == "" {
		return makeContent("type is required (weekly_distance or monthly_distance)")
	}
	if args.TargetMeters <= 0 {
		return makeContent("targetMeters must be > 0")
	}

	goal := planning.Goal{
		ID:           fmt.Sprintf("goal-%d", time.Now().UnixNano()),
		Type:         args.Type,
		TargetMeters: args.TargetMeters,
		Active:       true,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if err := planning.InsertGoal(ctx, p.db, goal); err != nil {
		return makeContent(fmt.Sprintf("Failed to create goal: %v", err))
	}

	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(goal)
	return makeContent(fmt.Sprintf("Goal created successfully.\n\n%s", buf.String()))
}

func (p *AgonToolProvider) callCreatePlannedSession(ctx context.Context, argsJSON string) ([]MCPToolContentPart, error) {
	if p.db == nil {
		return makeContent("Database not available")
	}

	var args CreatePlannedSessionArgs
	dec := json.NewDecoder(strings.NewReader(argsJSON))
	if err := dec.Decode(&args); err != nil {
		return makeContent(fmt.Sprintf("Invalid arguments: %v", err))
	}

	if args.Date == "" {
		return makeContent("date is required (YYYY-MM-DD)")
	}

	session := planning.PlannedSession{
		ID:                   fmt.Sprintf("planned-%d", time.Now().UnixNano()),
		Date:                 args.Date,
		TrainingType:         args.TrainingType,
		Title:                args.Title,
		TargetDistanceMeters: args.TargetDistanceMeters,
		TargetDurationSecs:   args.TargetDurationSecs,
		TargetPaceSecPerKm:   args.TargetPaceSecPerKm,
		Notes:                args.Notes,
		CreatedAt:            time.Now().UTC().Format(time.RFC3339),
	}
	if err := planning.InsertPlannedSession(ctx, p.db, session); err != nil {
		return makeContent(fmt.Sprintf("Failed to create planned session: %v", err))
	}

	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(session)
	return makeContent(fmt.Sprintf("Planned session created.\n\n%s", buf.String()))
}

func (p *AgonToolProvider) callUpdateTemplate(ctx context.Context, argsJSON string) ([]MCPToolContentPart, error) {
	if p.db == nil {
		return makeContent("Database not available")
	}

	var args UpdateTemplateArgs
	dec := json.NewDecoder(strings.NewReader(argsJSON))
	if err := dec.Decode(&args); err != nil {
		return makeContent(fmt.Sprintf("Invalid arguments: %v", err))
	}

	slots := make([]planning.ScheduleSlot, 0, len(args.Days))
	for _, d := range args.Days {
		slots = append(slots, planning.ScheduleSlot{
			DayOfWeek:            d.DayOfWeek,
			TrainingType:         d.TrainingType,
			Title:                d.Title,
			TargetDistanceMeters: d.TargetDistanceMeters,
			TargetDurationSecs:   d.TargetDurationSecs,
			TargetPaceSecPerKm:   d.TargetPaceSecPerKm,
			Notes:                d.Notes,
		})
	}

	if err := planning.ReplaceTemplate(ctx, p.db, slots); err != nil {
		return makeContent(fmt.Sprintf("Failed to update template: %v", err))
	}

	return makeContent(fmt.Sprintf("Schedule template updated with %d days.", len(slots)))
}

func (p *AgonToolProvider) callUpdatePlanStatus(ctx context.Context, argsJSON string) ([]MCPToolContentPart, error) {
	if p.db == nil {
		return makeContent("Database not available")
	}

	var args UpdatePlanStatusArgs
	dec := json.NewDecoder(strings.NewReader(argsJSON))
	if err := dec.Decode(&args); err != nil {
		return makeContent(fmt.Sprintf("Invalid arguments: %v", err))
	}

	if args.PlanID == "" || args.Status == "" {
		return makeContent("planId and status are required")
	}
	if args.Status != trainingplan.PlanStatusDraft && args.Status != trainingplan.PlanStatusActive && args.Status != trainingplan.PlanStatusArchived {
		return makeContent(fmt.Sprintf("Invalid status: %s (must be draft, active, or archived)", args.Status))
	}

	if err := trainingplan.UpdatePlanStatus(ctx, p.db, args.PlanID, args.Status); err != nil {
		return makeContent(fmt.Sprintf("Failed to update plan status: %v", err))
	}

	return makeContent(fmt.Sprintf("Plan %s status updated to %s.", args.PlanID, args.Status))
}
func (p *AgonToolProvider) callSetActivityWorkout(ctx context.Context, argsJSON string) ([]MCPToolContentPart, error) {
	if p.db == nil {
		return makeContent("Database not available")
	}

	var args SetActivityWorkoutArgs
	if err := json.NewDecoder(strings.NewReader(argsJSON)).Decode(&args); err != nil {
		return makeContent(fmt.Sprintf("Invalid arguments: %v", err))
	}
	if args.ActivityID == "" {
		return makeContent("activityId is required")
	}

	rec, err := activities.SaveWorkout(ctx, p.db, p.store, args.ActivityID, args.WorkoutType, args.Intervals)
	if err != nil {
		return makeContent(fmt.Sprintf("Failed to update workout: %v", err))
	}

	buf := strings.Builder{}
	_ = json.NewEncoder(&buf).Encode(map[string]any{
		"id":          rec.ID,
		"workoutType": rec.WorkoutType,
		"intervals":   rec.Intervals,
	})
	return makeContent(fmt.Sprintf("Workout updated for %s.\n\n%s", rec.ID, buf.String()))
}

func countWork(intervals []activities.Interval) int {
	n := 0
	for _, iv := range intervals {
		if iv.Kind == activities.IntervalKindWork {
			n++
		}
	}
	return n
}
