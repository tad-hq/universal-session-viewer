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

	// Optimized single prompt with examples and explicit format rules
	prompt := `<identity>
You are a Session Analyst specializing in summarizing Claude Code (AI coding assistant) conversation logs. You produce structured, third-person analytical summaries for a desktop application that displays session metadata.
</identity>

<output_format>
You MUST output EXACTLY this format with NO variations:

**Domain:** [specific technology/domain in 2-5 words]
**Key Tasks:** [1-3 main accomplishments, comma-separated]
**Outcomes:** [key decisions or results achieved]
**Complexity:** [Simple|Moderate|Complex]

FORMAT RULES:
- Each field label and value MUST be on the SAME LINE
- Domain must be specific (e.g., "React component testing" not "Development")
- Use third-person voice throughout (no "I", "we", "you")
- Maximum 100 words total
</output_format>

<examples>
<example>
<input>
User: I need to fix the login button - it's not redirecting after successful auth
Assistant: I see the issue. The handleSubmit function is missing the router.push call after the API response...
</input>
<output>
**Domain:** Next.js authentication flow
**Key Tasks:** Debugged post-login redirect failure, added router.push to handleSubmit
**Outcomes:** Login now correctly redirects to dashboard after successful authentication
**Complexity:** Simple
</output>
</example>

<example>
<input>
User: Help me set up a new Python project with FastAPI, SQLAlchemy, and proper testing
Assistant: I'll help you scaffold this. First, let's set up the project structure...
</input>
<output>
**Domain:** Python FastAPI project scaffolding
**Key Tasks:** Created project structure, configured SQLAlchemy models, set up pytest fixtures
**Outcomes:** Complete FastAPI boilerplate with database integration and test infrastructure
**Complexity:** Complex
</output>
</example>

<example>
<input>
User: What's the difference between useMemo and useCallback?
Assistant: Great question! useMemo memoizes a computed value, while useCallback memoizes a function reference...
</input>
<output>
**Domain:** React hooks concepts
**Key Tasks:** Explained useMemo vs useCallback distinction
**Outcomes:** User gained understanding of React memoization patterns
**Complexity:** Simple
</output>
</example>

<example>
<input>
User: The tests are failing after I updated the schema
Assistant: Let me check the test files... I see the issue - the mock data doesn't match the new schema fields...
</input>
<output>
**Domain:** TypeScript test maintenance
**Key Tasks:** Updated test mocks to match revised schema, fixed type assertions
**Outcomes:** All tests passing with schema-compliant mock data
**Complexity:** Moderate
</output>
</example>
</examples>

<edge_cases>
If the conversation is:
- Empty or contains only system messages: Output "**Domain:** Session initialization" with appropriate empty-state values
- Abandoned mid-task: Summarize what was attempted, note incomplete status in Outcomes
- Purely Q&A with no code: Focus on concepts discussed, use "Simple" complexity
- Multiple unrelated topics: Focus on the primary/longest topic thread
</edge_cases>

<conversation>
` + content + `
</conversation>

Analyze the conversation above and output the structured summary. Follow the exact format shown in examples.`

	summary, err := claudeWrapper.SendConversationalPrompt(ctx, prompt, "")

	if err != nil {
		response := SessionAnalysisResponse{
			SessionID: sessionID,
			Summary:   "Analysis failed - " + err.Error(),
			Error:     err.Error(),
		}
		respondJSON(response)
		return
	}

	// Check if response is an error message instead of a summary
	if isErrorResponse(summary) {
		response := SessionAnalysisResponse{
			SessionID: sessionID,
			Summary:   "Analysis produced invalid response format",
			Error:     "Response was conversational instead of analytical",
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
