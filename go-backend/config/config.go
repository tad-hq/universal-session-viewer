package config

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Config holds all configuration for the session viewer
type Config struct {
	Claude ClaudeConfig
	Paths  PathsConfig
}

// ClaudeConfig contains Claude CLI configuration
type ClaudeConfig struct {
	BinaryPath string        // Path to claude binary (default: "claude")
	Model      string        // Model to use (default: claude-haiku-4-5-20251001)
	Timeout    time.Duration // Command timeout (default: 10 minutes)
}

// PathsConfig contains filesystem path configuration
type PathsConfig struct {
	AnalysisDir string // Directory for analysis sessions
}

// LoadConfig loads configuration from environment variables with defaults
// Supported environment variables:
//   - CLAUDE_BINARY_PATH: Path to claude binary (default: "claude")
//   - CLAUDE_MODEL: Model to use (default: claude-haiku-4-5-20251001)
//   - ANALYSIS_DIR: Analysis directory (default: ~/.universal-session-viewer/analysis)
func LoadConfig() (*Config, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	cfg := &Config{
		Claude: ClaudeConfig{
			BinaryPath: getEnvOrDefault("CLAUDE_BINARY_PATH", "claude"),
			Model:      getEnvOrDefault("CLAUDE_MODEL", DefaultModel),
			Timeout:    time.Duration(DefaultTimeout) * time.Minute,
		},
		Paths: PathsConfig{
			AnalysisDir: ExpandPath(getEnvOrDefault(
				"ANALYSIS_DIR",
				filepath.Join(homeDir, ".universal-session-viewer", "analysis"),
			)),
		},
	}

	return cfg, nil
}

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ExpandPath expands ~ and environment variables in paths
func ExpandPath(path string) string {
	if len(path) == 0 {
		return path
	}

	if path[0] == '~' {
		homeDir, err := os.UserHomeDir()
		if err == nil {
			path = filepath.Join(homeDir, path[1:])
		}
	}

	path = os.ExpandEnv(path)

	return filepath.Clean(path)
}

// ExpandHomePath expands ~ to home directory
func ExpandHomePath(path string) string {
	if !strings.HasPrefix(path, "~") {
		return path
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return path
	}

	if path == "~" {
		return homeDir
	}

	return filepath.Join(homeDir, path[1:])
}
