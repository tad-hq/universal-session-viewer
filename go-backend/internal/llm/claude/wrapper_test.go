package claude

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tadschnitzer/universal-session-viewer/go-backend/config"
)

// TestNewWrapper tests wrapper initialization
func TestNewWrapper(t *testing.T) {
	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
		Paths: config.PathsConfig{
			AnalysisDir: "/test/path",
		},
	}

	wrapper := NewWrapper(cfg)
	if wrapper == nil {
		t.Fatal("NewWrapper returned nil")
	}

	if wrapper.config != cfg {
		t.Error("Wrapper config not set correctly")
	}
}

// TestGenerateSessionID tests session ID generation
func TestGenerateSessionID(t *testing.T) {
	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
	}
	wrapper := NewWrapper(cfg)

	sessionID, err := wrapper.generateSessionID()
	if err != nil {
		t.Fatalf("generateSessionID failed: %v", err)
	}

	// Verify format (should be UUID-like with hyphens)
	if sessionID == "" {
		t.Error("Generated session ID is empty")
	}

	parts := strings.Split(sessionID, "-")
	if len(parts) != 5 {
		t.Errorf("Expected 5 parts in session ID, got %d: %s", len(parts), sessionID)
	}

	// Generate another and verify they're different
	sessionID2, err := wrapper.generateSessionID()
	if err != nil {
		t.Fatalf("generateSessionID failed on second call: %v", err)
	}

	if sessionID == sessionID2 {
		t.Error("Generated session IDs should be unique")
	}
}

// TestCreateTempAnalysisDirectory tests temp directory creation
func TestCreateTempAnalysisDirectory(t *testing.T) {
	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
	}
	wrapper := NewWrapper(cfg)

	sessionID := "test-session-123"
	tempDir, err := wrapper.createTempAnalysisDirectory(sessionID)
	if err != nil {
		t.Fatalf("createTempAnalysisDirectory failed: %v", err)
	}

	// Clean up
	defer os.RemoveAll(tempDir)

	// Verify directory was created
	if _, err := os.Stat(tempDir); os.IsNotExist(err) {
		t.Error("Temp directory was not created")
	}

	// Verify directory name contains session ID
	if !strings.Contains(tempDir, sessionID) {
		t.Errorf("Expected temp dir to contain session ID %q, got: %s", sessionID, tempDir)
	}
}

// TestCleanupTempAnalysisDirectory tests cleanup
func TestCleanupTempAnalysisDirectory(t *testing.T) {
	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
	}
	wrapper := NewWrapper(cfg)

	// Create a temp directory
	sessionID := "test-cleanup-123"
	tempDir, err := wrapper.createTempAnalysisDirectory(sessionID)
	if err != nil {
		t.Fatalf("createTempAnalysisDirectory failed: %v", err)
	}

	// Verify it exists
	if _, err := os.Stat(tempDir); os.IsNotExist(err) {
		t.Fatal("Temp directory was not created")
	}

	// Clean it up
	wrapper.cleanupTempAnalysisDirectory(tempDir, sessionID)

	// Verify it's gone
	if _, err := os.Stat(tempDir); !os.IsNotExist(err) {
		t.Error("Temp directory was not cleaned up")
	}
}

// TestSanitizeProjectPath tests path sanitization
func TestSanitizeProjectPath(t *testing.T) {
	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
	}
	wrapper := NewWrapper(cfg)

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Simple path",
			input:    "/Users/test/project",
			expected: "-Users-test-project",
		},
		{
			name:     "Path with dotfiles",
			input:    "/Users/test/.config/app",
			expected: "-Users-test-.config-app",
		},
		{
			name:     "Deep nested path",
			input:    "/var/tmp/analysis/session-123",
			expected: "-var-tmp-analysis-session-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := wrapper.sanitizeProjectPath(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeProjectPath(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestGetAnalysisDirectory tests analysis directory creation
func TestGetAnalysisDirectory(t *testing.T) {
	// Create temp directory for testing
	tempBase, err := os.MkdirTemp("", "test-analysis-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempBase)

	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
		Paths: config.PathsConfig{
			AnalysisDir: tempBase,
		},
	}
	wrapper := NewWrapper(cfg)

	analysisDir, err := wrapper.getAnalysisDirectory()
	if err != nil {
		t.Fatalf("getAnalysisDirectory failed: %v", err)
	}

	// Verify directory was created
	if _, err := os.Stat(analysisDir); os.IsNotExist(err) {
		t.Error("Analysis directory was not created")
	}

	// Verify it's a subdirectory of the base
	if !strings.HasPrefix(analysisDir, tempBase) {
		t.Errorf("Analysis dir %q should be under %q", analysisDir, tempBase)
	}

	// Verify date-based subdirectory format (MMDDYY)
	dateStr := time.Now().Format("010206")
	if !strings.Contains(analysisDir, dateStr) {
		t.Errorf("Expected analysis dir to contain date %q, got: %s", dateStr, analysisDir)
	}
}

// TestSetupAgentsDirectory tests agents directory setup
func TestSetupAgentsDirectory(t *testing.T) {
	// Create temp directory for testing
	tempDir, err := os.MkdirTemp("", "test-agents-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "claude",
			Model:      "test-model",
			Timeout:    5 * time.Minute,
		},
	}
	wrapper := NewWrapper(cfg)

	err = wrapper.setupAgentsDirectory(tempDir)
	if err != nil {
		t.Fatalf("setupAgentsDirectory failed: %v", err)
	}

	// Verify .claude/agents directory was created
	agentsDir := filepath.Join(tempDir, ".claude", "agents")
	if _, err := os.Stat(agentsDir); os.IsNotExist(err) {
		t.Error("Agents directory was not created")
	}
}

// TestSendConversationalPromptWithSessionID tests using existing session ID
func TestSendConversationalPromptWithSessionID(t *testing.T) {
	// Create temp directory for testing
	tempBase, err := os.MkdirTemp("", "test-session-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempBase)

	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "echo", // Use echo to avoid actual Claude call
			Model:      "test-model",
			Timeout:    5 * time.Second,
		},
		Paths: config.PathsConfig{
			AnalysisDir: tempBase,
		},
	}
	wrapper := NewWrapper(cfg)

	// Create analysis directory first
	analysisDir, err := wrapper.getAnalysisDirectory()
	if err != nil {
		t.Fatalf("getAnalysisDirectory failed: %v", err)
	}

	ctx := context.Background()
	sessionID := "existing-session-123"

	// This should not create a temp directory since session ID is provided
	result, err := wrapper.SendConversationalPrompt(ctx, "test prompt", sessionID)

	// With echo command, we expect success or specific error
	if err != nil && !strings.Contains(err.Error(), "empty response") {
		// empty response is acceptable since echo doesn't produce expected output
		if !strings.Contains(err.Error(), "exit status") {
			t.Logf("SendConversationalPrompt error (may be expected): %v", err)
		}
	}

	// Verify no temp directory in /tmp (session ID was provided)
	tempPattern := filepath.Join(os.TempDir(), "claude-analysis-"+sessionID)
	if _, err := os.Stat(tempPattern); err == nil {
		t.Error("Temp directory should not be created when session ID is provided")
	}

	// Verify analysis directory still exists
	if _, err := os.Stat(analysisDir); os.IsNotExist(err) {
		t.Error("Analysis directory should exist")
	}

	_ = result // Ignore result content for this test
}

// TestWrapperConfigAccess tests that wrapper respects config
func TestWrapperConfigAccess(t *testing.T) {
	customModel := "custom-test-model"
	customTimeout := 3 * time.Minute

	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "/custom/claude",
			Model:      customModel,
			Timeout:    customTimeout,
		},
		Paths: config.PathsConfig{
			AnalysisDir: "/custom/analysis",
		},
	}

	wrapper := NewWrapper(cfg)

	// Verify config is stored
	if wrapper.config.Claude.Model != customModel {
		t.Errorf("Expected model %q, got %q", customModel, wrapper.config.Claude.Model)
	}

	if wrapper.config.Claude.Timeout != customTimeout {
		t.Errorf("Expected timeout %v, got %v", customTimeout, wrapper.config.Claude.Timeout)
	}

	if wrapper.config.Claude.BinaryPath != "/custom/claude" {
		t.Errorf("Expected binary path %q, got %q", "/custom/claude", wrapper.config.Claude.BinaryPath)
	}
}

// TestSendConversationalPromptErrorHandling tests error handling for missing binary
func TestSendConversationalPromptErrorHandling(t *testing.T) {
	// Create temp directory for testing
	tempBase, err := os.MkdirTemp("", "test-error-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempBase)

	cfg := &config.Config{
		Claude: config.ClaudeConfig{
			BinaryPath: "/nonexistent/binary/claude", // Binary that doesn't exist
			Model:      "test-model",
			Timeout:    5 * time.Second,
		},
		Paths: config.PathsConfig{
			AnalysisDir: tempBase,
		},
	}
	wrapper := NewWrapper(cfg)

	ctx := context.Background()
	_, err = wrapper.SendConversationalPrompt(ctx, "test prompt", "")

	// Should get an error for nonexistent binary
	if err == nil {
		t.Error("Expected error for nonexistent binary, got nil")
	}
}
