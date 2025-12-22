package claude

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/tadschnitzer/universal-session-viewer/go-backend/config"
)

// Wrapper provides interface to Claude CLI
type Wrapper struct {
	config *config.Config
}

// NewWrapper creates a Claude CLI wrapper with the given configuration
func NewWrapper(cfg *config.Config) *Wrapper {
	return &Wrapper{
		config: cfg,
	}
}

// generateSessionID creates a unique session ID for conversation tracking
func (w *Wrapper) generateSessionID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", bytes[0:4], bytes[4:6], bytes[6:8], bytes[8:10], bytes[10:16]), nil
}

// createTempAnalysisDirectory creates a temporary directory for analysis session
func (w *Wrapper) createTempAnalysisDirectory(sessionID string) (string, error) {
	tempDir := filepath.Join(os.TempDir(), "claude-analysis-"+sessionID)

	err := os.MkdirAll(tempDir, 0755)
	if err != nil {
		return "", fmt.Errorf("failed to create temp analysis directory %s: %w", tempDir, err)
	}

	fmt.Fprintf(os.Stderr, "Created temporary analysis directory: %s\n", tempDir)
	return tempDir, nil
}

// cleanupTempAnalysisDirectory removes the temporary directory and its contents,
// as well as the specific Claude CLI session file created in ~/.claude/projects/
func (w *Wrapper) cleanupTempAnalysisDirectory(tempDir string, sessionID string) {
	if err := os.RemoveAll(tempDir); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: Could not cleanup temp analysis directory %s: %v\n", tempDir, err)
	} else {
		fmt.Fprintf(os.Stderr, "Cleaned up temporary analysis directory: %s\n", tempDir)
	}

	// Also clean up the specific Claude CLI session file in ~/.claude/projects/
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: Could not get home directory for session cleanup: %v\n", err)
		return
	}

	// Convert temp dir path to Claude's sanitized format (e.g., /private/tmp/foo -> -private-tmp-foo)
	sanitizedPath := w.sanitizeProjectPath(tempDir)
	claudeProjectDir := filepath.Join(homeDir, ".claude", "projects", sanitizedPath)

	// Remove only the specific session JSONL file
	sessionFile := filepath.Join(claudeProjectDir, sessionID+".jsonl")
	if _, err := os.Stat(sessionFile); err == nil {
		if err := os.Remove(sessionFile); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Could not cleanup Claude CLI session file %s: %v\n", sessionFile, err)
		} else {
			fmt.Fprintf(os.Stderr, "Cleaned up Claude CLI session file: %s\n", sessionFile)
		}
	}

	// If the project directory is now empty, remove it too
	entries, err := os.ReadDir(claudeProjectDir)
	if err == nil && len(entries) == 0 {
		if err := os.Remove(claudeProjectDir); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Could not cleanup empty Claude CLI project directory %s: %v\n", claudeProjectDir, err)
		} else {
			fmt.Fprintf(os.Stderr, "Cleaned up empty Claude CLI project directory: %s\n", claudeProjectDir)
		}
	}
}

// sanitizeProjectPath converts a file path to Claude Code's project directory format
// Example: /Users/username/.universal-session-viewer/analysis/121025 -> -Users-username-.universal-session-viewer-analysis-121025
func (w *Wrapper) sanitizeProjectPath(path string) string {
	// Remove leading slash and replace all path separators with dashes
	sanitized := strings.TrimPrefix(path, "/")
	sanitized = strings.ReplaceAll(sanitized, "/", "-")
	// Add leading dash to match Claude Code format
	return "-" + sanitized
}

// getAnalysisDirectory creates and returns the analysis directory for today.
// Uses date-based subdirectories (MMDDYY format) for organization.
func (w *Wrapper) getAnalysisDirectory() (string, error) {
	now := time.Now()
	dateStr := now.Format("010206") // MMDDYY format

	analysisDir := filepath.Join(w.config.Paths.AnalysisDir, dateStr)

	err := os.MkdirAll(analysisDir, 0755)
	if err != nil {
		return "", fmt.Errorf("failed to create analysis directory %s: %w", analysisDir, err)
	}

	// Set up agents directory for Claude to discover subagents
	err = w.setupAgentsDirectory(analysisDir)
	if err != nil {
		// Log warning but don't fail - agents are optional
		fmt.Fprintf(os.Stderr, "warning: failed to setup agents directory: %v\n", err)
	}

	return analysisDir, nil
}

// setupAgentsDirectory creates .claude/agents directory structure.
// Agents are optional - errors don't fail the session.
func (w *Wrapper) setupAgentsDirectory(analysisDir string) error {
	claudeDir := filepath.Join(analysisDir, ".claude")
	agentsDir := filepath.Join(claudeDir, "agents")

	err := os.MkdirAll(agentsDir, 0755)
	if err != nil {
		return fmt.Errorf("failed to create agents directory %s: %w", agentsDir, err)
	}

	return nil
}

// SendConversationalPrompt sends a prompt and returns raw text response (no JSON validation).
// Used for interactive conversations, not for structured analysis.
// Handles temp directory cleanup, session ID generation, and timeout management.
func (w *Wrapper) SendConversationalPrompt(ctx context.Context, prompt string, sessionID string) (string, error) {
	analysisDir, err := w.getAnalysisDirectory()
	if err != nil {
		return "", fmt.Errorf("failed to get analysis directory: %w", err)
	}

	cmdCtx, cancel := context.WithTimeout(ctx, w.config.Claude.Timeout)
	defer cancel()

	tempAnalysisDir := ""

	// Build command - use session ID if provided, otherwise create new one
	if sessionID == "" {
		var err error
		sessionID, err = w.generateSessionID()
		if err != nil {
			return "", fmt.Errorf("failed to generate session ID: %w", err)
		}

		// Create a temporary directory for this analysis to avoid polluting the main analysis directory
		tempAnalysisDir, err = w.createTempAnalysisDirectory(sessionID)
		if err != nil {
			return "", fmt.Errorf("failed to create temp analysis directory: %w", err)
		}
		analysisDir = tempAnalysisDir // Use temp directory instead
	}

	cmd := exec.CommandContext(cmdCtx, w.config.Claude.BinaryPath,
		"--model", w.config.Claude.Model,
		"--session-id", sessionID,
		"-p", prompt,
	)

	cmd.Dir = analysisDir

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()

	// Cleanup temporary directory and session file if we created one
	if tempAnalysisDir != "" {
		w.cleanupTempAnalysisDirectory(tempAnalysisDir, sessionID)
	}

	if err != nil {
		if cmdCtx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("claude command timed out after %v", w.config.Claude.Timeout)
		}
		return "", fmt.Errorf("claude command failed: %w, stderr: %s", err, stderr.String())
	}

	responseText := stdout.String()

	if responseText == "" {
		return "", fmt.Errorf("claude returned empty response")
	}

	return responseText, nil
}
