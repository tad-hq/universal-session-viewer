package validator

import (
	"strings"
	"testing"
	"time"

	"github.com/tadschnitzer/universal-session-viewer/go-backend/internal/llm"
)

// TestValidateAnalysisJSON tests JSON validation
func TestValidateAnalysisJSON(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectValid bool
		expectError string
	}{
		{
			name: "Valid direct JSON",
			input: `{
				"episodes": [
					{
						"id": "ep1",
						"phase": "implementation",
						"confidence": 0.9,
						"description": "Test episode",
						"start_line": 1,
						"end_line": 10
					}
				],
				"patterns": {
					"workflow": "iterative",
					"efficiency": "high"
				},
				"metadata": {
					"processing_tier": 1,
					"token_count": 100,
					"processing_time_seconds": 1.5,
					"model": "test-model",
					"analysis_version": "1.0",
					"timestamp": "2024-01-01T00:00:00Z"
				},
				"recommendations": ["test recommendation"]
			}`,
			expectValid: true,
		},
		{
			name: "Valid JSON in markdown",
			input: "```json\n" + `{
				"episodes": [
					{
						"id": "ep1",
						"phase": "implementation",
						"confidence": 0.9,
						"description": "Test episode",
						"start_line": 1,
						"end_line": 10
					}
				],
				"patterns": {
					"workflow": "iterative",
					"efficiency": "high"
				},
				"metadata": {
					"processing_tier": 1,
					"token_count": 100,
					"processing_time_seconds": 1.5,
					"model": "test-model",
					"analysis_version": "1.0",
					"timestamp": "2024-01-01T00:00:00Z"
				},
				"recommendations": []
			}` + "\n```",
			expectValid: true,
		},
		{
			name:        "Missing episodes",
			input:       `{"patterns": {"workflow": "test"}, "metadata": {}, "recommendations": []}`,
			expectValid: false,
			expectError: "Missing required field: episodes",
		},
		{
			name:        "Missing patterns",
			input:       `{"episodes": [], "metadata": {}, "recommendations": []}`,
			expectValid: false,
			expectError: "Missing required field: patterns",
		},
		{
			name:        "Invalid JSON syntax",
			input:       `{"episodes": [}`,
			expectValid: false,
			expectError: "Invalid JSON syntax",
		},
		{
			name:        "No JSON found",
			input:       "This is just plain text without any JSON",
			expectValid: false,
			expectError: "No JSON object found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateAnalysisJSON(tt.input)

			if result.Valid != tt.expectValid {
				t.Errorf("Expected valid=%v, got %v. Errors: %v", tt.expectValid, result.Valid, result.Errors)
			}

			if !tt.expectValid && tt.expectError != "" {
				found := false
				for _, err := range result.Errors {
					if strings.Contains(err, tt.expectError) {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Expected error containing %q, got errors: %v", tt.expectError, result.Errors)
				}
			}

			if tt.expectValid && result.Extracted == nil {
				t.Error("Expected extracted analysis for valid input, got nil")
			}
		})
	}
}

// TestValidateAnalysisStructure tests structure validation
func TestValidateAnalysisStructure(t *testing.T) {
	tests := []struct {
		name        string
		analysis    *llm.Analysis
		expectValid bool
		expectError string
	}{
		{
			name: "Valid structure",
			analysis: &llm.Analysis{
				Episodes: []*llm.Episode{
					{
						ID:          "ep1",
						Phase:       "implementation",
						Confidence:  0.9,
						Description: "Test episode",
					},
				},
				Patterns: &llm.WorkflowPatterns{
					Workflow:   "iterative",
					Efficiency: "high",
				},
				Metadata: llm.AnalysisMetadata{
					Model:           "test-model",
					AnalysisVersion: "1.0",
				},
			},
			expectValid: true,
		},
		{
			name: "Episode missing ID",
			analysis: &llm.Analysis{
				Episodes: []*llm.Episode{
					{
						Phase:       "implementation",
						Confidence:  0.9,
						Description: "Test episode",
					},
				},
				Patterns: &llm.WorkflowPatterns{
					Workflow:   "iterative",
					Efficiency: "high",
				},
				Metadata: llm.AnalysisMetadata{},
			},
			expectValid: false,
			expectError: "Episode 0 missing ID",
		},
		{
			name: "Episode missing phase",
			analysis: &llm.Analysis{
				Episodes: []*llm.Episode{
					{
						ID:          "ep1",
						Confidence:  0.9,
						Description: "Test episode",
					},
				},
				Patterns: &llm.WorkflowPatterns{
					Workflow:   "iterative",
					Efficiency: "high",
				},
				Metadata: llm.AnalysisMetadata{},
			},
			expectValid: false,
			expectError: "Episode 0 missing phase",
		},
		{
			name: "Invalid confidence value",
			analysis: &llm.Analysis{
				Episodes: []*llm.Episode{
					{
						ID:          "ep1",
						Phase:       "implementation",
						Confidence:  1.5,
						Description: "Test episode",
					},
				},
				Patterns: &llm.WorkflowPatterns{
					Workflow:   "iterative",
					Efficiency: "high",
				},
				Metadata: llm.AnalysisMetadata{},
			},
			expectValid: false,
			expectError: "confidence must be between 0.0 and 1.0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &ValidationResult{
				Errors:   []string{},
				Warnings: []string{},
			}
			result = validateAnalysisStructure(tt.analysis, result)

			if result.Valid != tt.expectValid {
				t.Errorf("Expected valid=%v, got %v. Errors: %v", tt.expectValid, result.Valid, result.Errors)
			}

			if !tt.expectValid && tt.expectError != "" {
				found := false
				for _, err := range result.Errors {
					if strings.Contains(err, tt.expectError) {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Expected error containing %q, got errors: %v", tt.expectError, result.Errors)
				}
			}
		})
	}
}

// TestExtractJSON tests JSON extraction from various formats
func TestExtractJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "JSON in code block",
			input:    "```json\n{\"key\": \"value\"}\n```",
			expected: "{\"key\": \"value\"}",
		},
		{
			name:     "Raw JSON object",
			input:    "Some text before {\"key\": \"value\"} some text after",
			expected: "{\"key\": \"value\"}",
		},
		{
			name:     "Nested JSON object",
			input:    "{\"outer\": {\"inner\": \"value\"}}",
			expected: "{\"outer\": {\"inner\": \"value\"}}",
		},
		{
			name:     "JSON with escaped quotes",
			input:    "{\"text\": \"He said \\\"hello\\\"\"}",
			expected: "{\"text\": \"He said \\\"hello\\\"\"}",
		},
		{
			name:     "No JSON found",
			input:    "Just plain text without JSON",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractJSON(tt.input)
			if result != tt.expected {
				t.Errorf("extractJSON(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestFormatValidationErrors tests error message formatting
func TestFormatValidationErrors(t *testing.T) {
	tests := []struct {
		name     string
		result   *ValidationResult
		contains string
	}{
		{
			name: "Valid result",
			result: &ValidationResult{
				Valid:    true,
				Errors:   []string{},
				Warnings: []string{},
			},
			contains: "✅ JSON is valid",
		},
		{
			name: "Valid with warnings",
			result: &ValidationResult{
				Valid:    true,
				Errors:   []string{},
				Warnings: []string{"Warning 1", "Warning 2"},
			},
			contains: "Warnings:",
		},
		{
			name: "Invalid with errors",
			result: &ValidationResult{
				Valid:  false,
				Errors: []string{"Error 1", "Error 2"},
			},
			contains: "❌ JSON validation failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			message := FormatValidationErrors(tt.result)
			if !strings.Contains(message, tt.contains) {
				t.Errorf("Expected message to contain %q, got: %s", tt.contains, message)
			}
		})
	}
}

// TestValidationResultStruct tests ValidationResult structure
func TestValidationResultStruct(t *testing.T) {
	result := &ValidationResult{
		Valid:    true,
		Errors:   []string{"error1"},
		Warnings: []string{"warning1"},
		Extracted: &llm.Analysis{
			Episodes: []*llm.Episode{},
			Patterns: &llm.WorkflowPatterns{},
			Metadata: llm.AnalysisMetadata{
				Timestamp: time.Now(),
			},
		},
	}

	if !result.Valid {
		t.Error("Valid field not working")
	}

	if len(result.Errors) != 1 {
		t.Error("Errors field not working")
	}

	if len(result.Warnings) != 1 {
		t.Error("Warnings field not working")
	}

	if result.Extracted == nil {
		t.Error("Extracted field not working")
	}
}

// TestEpisodeValidation tests episode-specific validation
func TestEpisodeValidation(t *testing.T) {
	tests := []struct {
		name         string
		episode      *llm.Episode
		expectErrors int
	}{
		{
			name: "Valid episode",
			episode: &llm.Episode{
				ID:          "ep1",
				Phase:       "implementation",
				Confidence:  0.85,
				Description: "Valid episode",
				StartLine:   1,
				EndLine:     10,
			},
			expectErrors: 0,
		},
		{
			name: "Missing description (warning only)",
			episode: &llm.Episode{
				ID:         "ep1",
				Phase:      "implementation",
				Confidence: 0.85,
				StartLine:  1,
				EndLine:    10,
			},
			expectErrors: 0, // Description is warning, not error
		},
		{
			name: "Confidence too high",
			episode: &llm.Episode{
				ID:          "ep1",
				Phase:       "implementation",
				Confidence:  1.5,
				Description: "Invalid confidence",
			},
			expectErrors: 1,
		},
		{
			name: "Confidence negative",
			episode: &llm.Episode{
				ID:          "ep1",
				Phase:       "implementation",
				Confidence:  -0.1,
				Description: "Negative confidence",
			},
			expectErrors: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			analysis := &llm.Analysis{
				Episodes: []*llm.Episode{tt.episode},
				Patterns: &llm.WorkflowPatterns{
					Workflow:   "test",
					Efficiency: "test",
				},
				Metadata: llm.AnalysisMetadata{},
			}

			result := &ValidationResult{
				Errors:   []string{},
				Warnings: []string{},
			}
			result = validateAnalysisStructure(analysis, result)

			if len(result.Errors) != tt.expectErrors {
				t.Errorf("Expected %d errors, got %d: %v", tt.expectErrors, len(result.Errors), result.Errors)
			}
		})
	}
}
