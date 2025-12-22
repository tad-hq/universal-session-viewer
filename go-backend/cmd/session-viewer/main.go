package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/tadschnitzer/universal-session-viewer/go-backend/config"
	"github.com/tadschnitzer/universal-session-viewer/go-backend/internal/llm/claude"
)

// SessionAnalysisRequest represents a request to analyze a session
type SessionAnalysisRequest struct {
	SessionID   string `json:"session_id"`
	ProjectPath string `json:"project_path"`
	FilePath    string `json:"file_path"`
	Content     string `json:"content"`
}

// SessionAnalysisResponse represents the analysis result
type SessionAnalysisResponse struct {
	SessionID string `json:"session_id"`
	Summary   string `json:"summary"`
	Error     string `json:"error,omitempty"`
}

// FilteredMessage represents a simplified message for analysis
type FilteredMessage struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		respondError(fmt.Sprintf("Failed to load configuration: %v", err))
		return
	}

	if len(os.Args) < 2 {
		respondError("Usage: session-viewer <command> [options]")
		return
	}

	command := os.Args[1]

	switch command {
	case "analyze":
		handleAnalyze(cfg)
	case "filter":
		handleFilter()
	case "help":
		printUsage()
	default:
		respondError(fmt.Sprintf("Unknown command: %s", command))
	}
}

func printUsage() {
	usage := map[string]interface{}{
		"usage": "session-viewer <command> [options]",
		"commands": map[string]string{
			"analyze": "analyze --session-id <id> --content <content>  - Analyze session content",
			"filter":  "filter --file <path>                           - Filter JSONL file",
			"help":    "help                                          - Show this help",
		},
	}
	respondJSON(usage)
}

// handleAnalyze processes session analysis using Claude Haiku
func handleAnalyze(cfg *config.Config) {
	if len(os.Args) < 4 {
		respondError("Usage: session-viewer analyze --session-id <id> --content <content>")
		return
	}

	// Parse arguments (simplified - in real implementation would use proper flag parsing)
	var sessionID, content string
	for i := 2; i < len(os.Args); i += 2 {
		if i+1 >= len(os.Args) {
			break
		}
		switch os.Args[i] {
		case "--session-id":
			sessionID = os.Args[i+1]
		case "--content":
			content = os.Args[i+1]
		}
	}

	if sessionID == "" || content == "" {
		respondError("Missing required arguments")
		return
	}

	claudeWrapper := claude.NewWrapper(cfg)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Retry mechanism: try up to 3 times with increasingly explicit prompts
	const maxRetries = 3
	var summary string
	var err error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		// Build analysis prompt with increasing explicitness on retries
		var prompt string
		if attempt == 1 {
			// Initial attempt: standard prompt
			prompt = `Analyze this Claude conversation and provide a concise summary:

1. Main topic/domain (e.g., "React development", "Python scripting")
2. Key tasks accomplished
3. Important outcomes or decisions
4. Session complexity (Simple/Moderate/Complex)

Keep it under 150 words. Focus only on the actual conversation content between user and assistant.

Conversation data:
` + content
		} else {
			// Retry attempts: strict prompt with system/role/few-shot techniques
			prompt = `SYSTEM: You are a professional conversation analyst. Your role is to provide objective, third-person analysis of completed conversations.

CRITICAL RULES:
1. Write ONLY in third person (never use "I", "we", "you")
2. Provide ANALYTICAL SUMMARY (not conversational responses)
3. Do NOT engage, validate, question, or provide advice
4. Do NOT start with exclamations, agreements, or disagreements (no "!", "No!", "Yes!", "You're right")

EXAMPLE - WRONG (Conversational):
"No! We're not removing that functionality. Let me explain the fix..."
"You're absolutely right! I made an error. Here's what we should do..."

EXAMPLE - CORRECT (Analytical):
"**Domain**: Python backend development
**Main Topic**: Debugging structured output retry wrapper implementation
**Key Tasks**: Resolved schema initialization issue in criterion analysis wrapper
**Complexity**: Moderate"

YOUR TASK: Analyze the conversation below and provide a structured summary with:
- Main topic/domain
- Key tasks accomplished
- Important outcomes
- Complexity level (Simple/Moderate/Complex)

Write objectively in third person. Maximum 150 words.

Conversation:
` + content
		}

		summary, err = claudeWrapper.SendConversationalPrompt(ctx, prompt, "")

		if err != nil {
			// Network/API error - no point retrying
			break
		}

		// Check if response is an error message instead of a summary
		isError := isErrorResponse(summary)

		if !isError {
			// Valid summary received
			break
		}

		// Invalid response detected, retry unless this was the last attempt
		if attempt < maxRetries {
			continue
		}
	}

	if err != nil {
		response := SessionAnalysisResponse{
			SessionID: sessionID,
			Summary:   "Analysis failed - " + err.Error(),
			Error:     err.Error(),
		}
		respondJSON(response)
		return
	}

	response := SessionAnalysisResponse{
		SessionID: sessionID,
		Summary:   summary,
	}

	respondJSON(response)
}

// handleFilter filters a JSONL file to extract only user/assistant content
func handleFilter() {
	if len(os.Args) < 3 {
		respondError("Usage: session-viewer filter --file <path>")
		return
	}

	var filePath string
	for i := 2; i < len(os.Args); i += 2 {
		if i+1 >= len(os.Args) {
			break
		}
		if os.Args[i] == "--file" {
			filePath = os.Args[i+1]
		}
	}

	if filePath == "" {
		respondError("Missing file path")
		return
	}

	messages, err := filterJSONLFile(filePath)
	if err != nil {
		respondError(fmt.Sprintf("Error filtering file: %v", err))
		return
	}

	respondJSON(messages)
}

// filterJSONLFile reads a JSONL file and extracts only user/assistant messages
func filterJSONLFile(filePath string) ([]FilteredMessage, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var messages []FilteredMessage
	decoder := json.NewDecoder(file)

	for decoder.More() {
		var line map[string]interface{}
		if err := decoder.Decode(&line); err != nil {
			continue // Skip invalid JSON lines
		}

		msgType, ok := line["type"].(string)
		if !ok {
			continue
		}

		timestamp, _ := line["timestamp"].(string)

		if msgType == "user" {
			if message, ok := line["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					messages = append(messages, FilteredMessage{
						Type:      "user",
						Content:   content,
						Timestamp: timestamp,
					})
				}
			}
		} else if msgType == "assistant" {
			if message, ok := line["message"].(map[string]interface{}); ok {
				if contentArray, ok := message["content"].([]interface{}); ok {
					var textBlocks []string
					for _, block := range contentArray {
						if blockMap, ok := block.(map[string]interface{}); ok {
							if blockType, ok := blockMap["type"].(string); ok && blockType == "text" {
								if text, ok := blockMap["text"].(string); ok {
									textBlocks = append(textBlocks, text)
								}
							}
						}
					}
					if len(textBlocks) > 0 {
						messages = append(messages, FilteredMessage{
							Type:      "assistant",
							Content:   joinStrings(textBlocks, "\n"),
							Timestamp: timestamp,
						})
					}
				}
			}
		}
	}

	// Return only the last 20 messages (most recent)
	if len(messages) > 20 {
		messages = messages[len(messages)-20:]
	}

	return messages, nil
}

// simulateAnalysis provides a mock analysis for demonstration
func simulateAnalysis(content string) string {
	// Simple keyword-based analysis for demo
	if contains(content, []string{"react", "component", "jsx", "frontend"}) {
		return "React development session focusing on component architecture and frontend implementation. Created responsive UI components with modern hooks and state management patterns. Moderate complexity with emphasis on user experience."
	}
	if contains(content, []string{"python", "script", "automation", "data"}) {
		return "Python scripting session for data automation and processing. Implemented file handling, data parsing, and automation workflows. Moderate complexity with focus on error handling and logging."
	}
	if contains(content, []string{"api", "backend", "server", "database"}) {
		return "Backend development session working on API design and database integration. Built RESTful endpoints with proper error handling and data validation. Complex architecture with scalability considerations."
	}
	if contains(content, []string{"chemistry", "reaction", "molecule", "synthesis"}) {
		return "Organic chemistry research session analyzing reaction mechanisms and molecular synthesis. Evaluated substrate reactivity and product formation pathways. High complexity with detailed chemical analysis."
	}

	return "General development session covering problem-solving and implementation tasks. Focus on code quality, testing, and documentation. Simple to moderate complexity depending on specific domain requirements."
}

// contains checks if content contains any of the keywords
func contains(content string, keywords []string) bool {
	lowerContent := strings.ToLower(content)
	for _, keyword := range keywords {
		if strings.Contains(lowerContent, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

// joinStrings concatenates a slice of strings
func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	if len(strs) == 1 {
		return strs[0]
	}

	result := strs[0]
	for _, s := range strs[1:] {
		result += sep + s
	}
	return result
}

// respondJSON outputs JSON response
func respondJSON(data interface{}) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		respondError(fmt.Sprintf("JSON encoding error: %v", err))
		return
	}
	fmt.Println(string(jsonData))
}

// respondError outputs error message
func respondError(message string) {
	response := map[string]interface{}{
		"error": message,
	}
	respondJSON(response)
}

// isErrorResponse checks if Claude's response is an out-of-scope error message
// instead of a proper analysis summary
func isErrorResponse(response string) bool {
	responseLower := strings.ToLower(response)

	// Very short responses are likely errors
	if len(strings.TrimSpace(response)) < 50 {
		return true
	}

	// Check for limitation/error phrases
	errorPhrases := []string{
		"i've hit a technical limitation",
		"i can't access",
		"i cannot access",
		"i don't have access",
		"i'm unable to access",
		"technical limitation",
		"i need you to",
		"please run",
		"please share",
		"let me ",              // AI offering to do something (e.g., "Let me revert my changes")
		"i'll ",                // AI committing to action
		"i will ",              // AI committing to action
		"the fix should",       // AI providing implementation advice instead of analysis
		"you should",           // AI giving instructions instead of analyzing
		"you need to",          // AI giving instructions
		"you're right",         // AI validating user in conversation (e.g., "You're absolutely right!")
		"you're absolutely",    // AI giving strong validation
		"you're correct",       // AI agreeing with user
		"i made a",             // AI admitting errors in active conversation
		"i apologize for",      // AI apologizing for mistakes
		"should i ",            // AI asking for permission/direction
		"shall i ",             // AI asking for direction
	}

	for _, phrase := range errorPhrases {
		if strings.Contains(responseLower, phrase) {
			return true
		}
	}

	// Check if response starts with action-oriented or conversational phrases (first 100 chars)
	responseStart := responseLower
	if len(responseStart) > 100 {
		responseStart = responseLower[:100]
	}
	actionStarts := []string{
		"here's the",
		"here is the",
		"i've created",
		"i've updated",
		"i've implemented",
		"no!",            // Conversational disagreement (e.g., "No! We're **not** removing...")
		"yes!",           // Conversational agreement
		"we're not",      // Conversational discussion about code
		"we're ",         // General conversational "we"
	}
	for _, phrase := range actionStarts {
		if strings.HasPrefix(responseStart, phrase) {
			return true
		}
	}

	// Check for exclamation marks in first sentence (very conversational)
	firstSentence := responseStart
	if dotPos := strings.Index(responseStart, "."); dotPos > 0 && dotPos < 100 {
		firstSentence = responseStart[:dotPos]
	}
	if strings.Contains(firstSentence, "!") {
		return true
	}

	// Check for questions directed at user
	questionPhrases := []string{
		"can you either:",
		"can you ",
		"could you ",
		"would you ",
		"can you please",
	}

	for _, phrase := range questionPhrases {
		if strings.Contains(responseLower, phrase) {
			return true
		}
	}

	// Check for code blocks suggesting commands to run
	if strings.Contains(response, "```bash") ||
	   strings.Contains(response, "```sh") ||
	   (strings.Contains(response, "```") && strings.Contains(responseLower, "cd /")) {
		return true
	}

	// Valid summary received
	return false
}
