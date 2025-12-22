package validator

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/tadschnitzer/universal-session-viewer/go-backend/internal/llm"
)

// ValidationResult represents the result of JSON validation
type ValidationResult struct {
	Valid      bool     `json:"valid"`
	Errors     []string `json:"errors,omitempty"`
	Warnings   []string `json:"warnings,omitempty"`
	Extracted  *llm.Analysis `json:"extracted,omitempty"`
}

// ValidateAnalysisJSON validates if the given text contains valid Analysis JSON
func ValidateAnalysisJSON(text string) *ValidationResult {
	result := &ValidationResult{
		Valid:    false,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Try to parse as direct JSON first
	var analysis llm.Analysis
	if err := json.Unmarshal([]byte(text), &analysis); err == nil {
		// Direct JSON worked, now validate structure
		return validateAnalysisStructure(&analysis, result)
	}

	// Try to extract JSON from markdown
	jsonStr := extractJSON(text)
	if jsonStr == "" {
		result.Errors = append(result.Errors, "No JSON object found in response")
		return result
	}

	if err := json.Unmarshal([]byte(jsonStr), &analysis); err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Invalid JSON syntax: %v", err))
		return result
	}

	return validateAnalysisStructure(&analysis, result)
}

// validateAnalysisStructure checks if the Analysis object has required fields
func validateAnalysisStructure(analysis *llm.Analysis, result *ValidationResult) *ValidationResult {
	// Check required fields
	if analysis.Episodes == nil {
		result.Errors = append(result.Errors, "Missing required field: episodes")
	}

	if analysis.Patterns == nil {
		result.Errors = append(result.Errors, "Missing required field: patterns")
	}

	// Metadata is a struct, check if it has default values
	if analysis.Metadata.Model == "" && analysis.Metadata.AnalysisVersion == "" {
		result.Warnings = append(result.Warnings, "Metadata appears incomplete")
	}

	// Validate episodes structure
	if analysis.Episodes != nil {
		for i, episode := range analysis.Episodes {
			if episode.ID == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("Episode %d missing ID", i))
			}
			if episode.Phase == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("Episode %d missing phase", i))
			}
			if episode.Description == "" {
				result.Warnings = append(result.Warnings, fmt.Sprintf("Episode %d missing description", i))
			}
			if episode.Confidence < 0 || episode.Confidence > 1 {
				result.Errors = append(result.Errors, fmt.Sprintf("Episode %d confidence must be between 0.0 and 1.0", i))
			}
		}
	}

	// Validate patterns structure
	if analysis.Patterns != nil {
		if analysis.Patterns.Workflow == "" {
			result.Warnings = append(result.Warnings, "Missing workflow pattern")
		}
		if analysis.Patterns.Efficiency == "" {
			result.Warnings = append(result.Warnings, "Missing efficiency pattern")
		}
	}

	// If no errors, mark as valid
	if len(result.Errors) == 0 {
		result.Valid = true
		result.Extracted = analysis
	}

	return result
}

// Extracts JSON from markdown-wrapped response or raw text
func extractJSON(text string) string {
	// Look for JSON code block
	start := strings.Index(text, "```json")
	if start != -1 {
		start += 7 // Skip ```json
		end := strings.Index(text[start:], "```")
		if end != -1 {
			return strings.TrimSpace(text[start : start+end])
		}
	}

	// Look for raw JSON object
	start = strings.Index(text, "{")
	if start != -1 {
		// Find matching closing brace
		depth := 0
		inString := false
		escape := false

		for i := start; i < len(text); i++ {
			if escape {
				escape = false
				continue
			}

			switch text[i] {
			case '\\':
				escape = true
			case '"':
				inString = !inString
			case '{':
				if !inString {
					depth++
				}
			case '}':
				if !inString {
					depth--
					if depth == 0 {
						return text[start : i+1]
					}
				}
			}
		}
	}

	return ""
}

// FormatValidationErrors creates a human-readable error message
func FormatValidationErrors(result *ValidationResult) string {
	if result.Valid {
		warningText := ""
		if len(result.Warnings) > 0 {
			warningText = fmt.Sprintf(" (Warnings: %s)", strings.Join(result.Warnings, ", "))
		}
		return fmt.Sprintf("✅ JSON is valid%s", warningText)
	}

	errorText := strings.Join(result.Errors, "; ")
	warningText := ""
	if len(result.Warnings) > 0 {
		warningText = fmt.Sprintf(" (Warnings: %s)", strings.Join(result.Warnings, ", "))
	}

	return fmt.Sprintf("❌ JSON validation failed: %s%s", errorText, warningText)
}
