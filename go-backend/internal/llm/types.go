package llm

import (
	"time"
)

// Analysis represents the complete analysis result from Claude
type Analysis struct {
	Episodes        []*Episode        `json:"episodes"`
	Patterns        *WorkflowPatterns `json:"patterns"`
	Recommendations []string          `json:"recommendations"`
	Metadata        AnalysisMetadata  `json:"metadata"`
}

// Episode represents a single development episode
type Episode struct {
	ID          string    `json:"id"`
	Phase       string    `json:"phase"`
	SubPhase    string    `json:"sub_phase,omitempty"`
	Confidence  float64   `json:"confidence"`
	Description string    `json:"description"`
	StartLine   int       `json:"start_line"`
	EndLine     int       `json:"end_line"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Duration    string    `json:"duration"`
	KeyInsights []string  `json:"key_insights,omitempty"`
	Resolution  string    `json:"resolution,omitempty"`
	Evidence    []string  `json:"evidence,omitempty"`
}

// WorkflowPatterns represents detected patterns in the workflow
type WorkflowPatterns struct {
	Workflow         string `json:"workflow"`
	Efficiency       string `json:"efficiency"`
	FrustrationLevel string `json:"frustration_level,omitempty"`
	LearningPattern  string `json:"learning_pattern,omitempty"`
	Collaboration    string `json:"collaboration,omitempty"`
}

// AnalysisMetadata contains metadata about the analysis
type AnalysisMetadata struct {
	ProcessingTier   int                    `json:"processing_tier"`
	TokenCount       int                    `json:"token_count"`
	ProcessingTime   float64                `json:"processing_time_seconds"`
	WindowCount      int                    `json:"window_count,omitempty"`
	Model            string                 `json:"model"`
	AnalysisVersion  string                 `json:"analysis_version"`
	Timestamp        time.Time              `json:"timestamp"`
	HierarchicalInfo map[string]interface{} `json:"hierarchical_info,omitempty"`
}

// WindowResult represents analysis result for a single window
type WindowResult struct {
	WindowID      int                    `json:"window_id"`
	WindowIndex   int                    `json:"window_index"`
	TotalWindows  int                    `json:"total_windows"`
	Episodes      []*Episode             `json:"episodes"`
	ContinuesTo   bool                   `json:"continues_to_next"`
	ContinuesFrom bool                   `json:"continues_from_previous"`
	OverlapRegion *OverlapInfo           `json:"overlap_region,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// OverlapInfo contains information about window overlap regions
type OverlapInfo struct {
	StartLine int    `json:"start_line"`
	EndLine   int    `json:"end_line"`
	Phase     string `json:"phase"`
	Confidence float64 `json:"confidence"`
}

// PromptTemplate represents different prompt types
type PromptTemplate string

const (
	PromptTier1Direct      PromptTemplate = "tier1_direct"
	PromptTier2Window      PromptTemplate = "tier2_window"
	PromptTier3Coarse      PromptTemplate = "tier3_coarse"
	PromptTier3Fine        PromptTemplate = "tier3_fine"
)

// ProcessingConfig holds configuration for processing
type ProcessingConfig struct {
	MaxRetries       int
	RetryDelay       time.Duration
	Timeout          time.Duration
	CacheEnabled     bool
	ParallelWindows  int
	WindowSize       int
	OverlapSize      int
}