package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestLoadConfig tests configuration loading with defaults
func TestLoadConfig(t *testing.T) {
	// Clear any environment variables
	os.Unsetenv("CLAUDE_BINARY_PATH")
	os.Unsetenv("CLAUDE_MODEL")
	os.Unsetenv("ANALYSIS_DIR")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	// Verify defaults
	if cfg.Claude.BinaryPath != "claude" {
		t.Errorf("Expected default binary path 'claude', got %q", cfg.Claude.BinaryPath)
	}

	if cfg.Claude.Model != DefaultModel {
		t.Errorf("Expected default model %q, got %q", DefaultModel, cfg.Claude.Model)
	}

	if cfg.Claude.Timeout != time.Duration(DefaultTimeout)*time.Minute {
		t.Errorf("Expected default timeout %v, got %v", time.Duration(DefaultTimeout)*time.Minute, cfg.Claude.Timeout)
	}

	// Verify analysis dir contains expected path components
	homeDir, _ := os.UserHomeDir()
	expectedDir := filepath.Join(homeDir, ".universal-session-viewer", "analysis")
	if cfg.Paths.AnalysisDir != expectedDir {
		t.Errorf("Expected analysis dir %q, got %q", expectedDir, cfg.Paths.AnalysisDir)
	}
}

// TestLoadConfigWithEnvironmentVariables tests configuration from env vars
func TestLoadConfigWithEnvironmentVariables(t *testing.T) {
	// Set environment variables
	os.Setenv("CLAUDE_BINARY_PATH", "/custom/path/claude")
	os.Setenv("CLAUDE_MODEL", "custom-model")
	os.Setenv("ANALYSIS_DIR", "/custom/analysis")
	defer func() {
		os.Unsetenv("CLAUDE_BINARY_PATH")
		os.Unsetenv("CLAUDE_MODEL")
		os.Unsetenv("ANALYSIS_DIR")
	}()

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	// Verify custom values
	if cfg.Claude.BinaryPath != "/custom/path/claude" {
		t.Errorf("Expected custom binary path, got %q", cfg.Claude.BinaryPath)
	}

	if cfg.Claude.Model != "custom-model" {
		t.Errorf("Expected custom model, got %q", cfg.Claude.Model)
	}

	if cfg.Paths.AnalysisDir != "/custom/analysis" {
		t.Errorf("Expected custom analysis dir, got %q", cfg.Paths.AnalysisDir)
	}
}

// TestGetEnvOrDefault tests environment variable helper
func TestGetEnvOrDefault(t *testing.T) {
	tests := []struct {
		name         string
		envKey       string
		envValue     string
		defaultValue string
		expected     string
	}{
		{
			name:         "Env var set",
			envKey:       "TEST_VAR_SET",
			envValue:     "custom-value",
			defaultValue: "default",
			expected:     "custom-value",
		},
		{
			name:         "Env var not set",
			envKey:       "TEST_VAR_UNSET",
			envValue:     "",
			defaultValue: "default",
			expected:     "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				os.Setenv(tt.envKey, tt.envValue)
				defer os.Unsetenv(tt.envKey)
			} else {
				os.Unsetenv(tt.envKey)
			}

			result := getEnvOrDefault(tt.envKey, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("getEnvOrDefault(%q, %q) = %q, want %q", tt.envKey, tt.defaultValue, result, tt.expected)
			}
		})
	}
}

// TestExpandPath tests path expansion with tilde and env vars
func TestExpandPath(t *testing.T) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to get home dir: %v", err)
	}

	tests := []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "Empty path",
			path:     "",
			expected: "", // ExpandPath returns empty for empty input
		},
		{
			name:     "Tilde expansion",
			path:     "~/test/path",
			expected: filepath.Join(homeDir, "test/path"),
		},
		{
			name:     "Absolute path unchanged",
			path:     "/absolute/path",
			expected: "/absolute/path",
		},
		{
			name:     "Relative path",
			path:     "relative/path",
			expected: "relative/path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExpandPath(tt.path)
			// Use filepath.Clean to normalize for comparison, except for empty string
			expected := tt.expected
			if tt.expected != "" {
				expected = filepath.Clean(tt.expected)
			}
			if result != expected {
				t.Errorf("ExpandPath(%q) = %q, want %q", tt.path, result, expected)
			}
		})
	}
}

// TestExpandPathWithEnvVars tests environment variable expansion
func TestExpandPathWithEnvVars(t *testing.T) {
	os.Setenv("TEST_DIR", "/test/directory")
	defer os.Unsetenv("TEST_DIR")

	path := "$TEST_DIR/subdir"
	result := ExpandPath(path)
	expected := filepath.Clean("/test/directory/subdir")

	if result != expected {
		t.Errorf("ExpandPath(%q) = %q, want %q", path, result, expected)
	}
}

// TestExpandHomePath tests home directory expansion utility
func TestExpandHomePath(t *testing.T) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to get home dir: %v", err)
	}

	tests := []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "Just tilde",
			path:     "~",
			expected: homeDir,
		},
		{
			name:     "Tilde with path",
			path:     "~/documents",
			expected: filepath.Join(homeDir, "documents"),
		},
		{
			name:     "No tilde - unchanged",
			path:     "/absolute/path",
			expected: "/absolute/path",
		},
		{
			name:     "No tilde - relative unchanged",
			path:     "relative/path",
			expected: "relative/path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExpandHomePath(tt.path)
			if result != tt.expected {
				t.Errorf("ExpandHomePath(%q) = %q, want %q", tt.path, result, tt.expected)
			}
		})
	}
}

// TestConfigDefaults verifies default constants
func TestConfigDefaults(t *testing.T) {
	if DefaultModel == "" {
		t.Error("DefaultModel should not be empty")
	}

	if !strings.Contains(DefaultModel, "claude") {
		t.Errorf("DefaultModel should contain 'claude', got %q", DefaultModel)
	}

	if DefaultTimeout <= 0 {
		t.Errorf("DefaultTimeout should be positive, got %d", DefaultTimeout)
	}
}

// TestConfigStructFields verifies Config struct has all required fields
func TestConfigStructFields(t *testing.T) {
	cfg := &Config{
		Claude: ClaudeConfig{
			BinaryPath: "test-binary",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
		Paths: PathsConfig{
			AnalysisDir: "/test/path",
		},
	}

	// Verify fields are accessible
	if cfg.Claude.BinaryPath != "test-binary" {
		t.Error("Claude.BinaryPath field not working")
	}

	if cfg.Claude.Model != "test-model" {
		t.Error("Claude.Model field not working")
	}

	if cfg.Claude.Timeout != 5*time.Minute {
		t.Error("Claude.Timeout field not working")
	}

	if cfg.Paths.AnalysisDir != "/test/path" {
		t.Error("Paths.AnalysisDir field not working")
	}
}
