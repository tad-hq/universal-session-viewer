# Universal Session Viewer MCP Server

MCP server that exposes Claude Code session data for agent access. Allows querying sessions, searching content, and exploring continuation chains.

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Claude Code Configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "usv": {
      "command": "node",
      "args": ["/path/to/universal-session-viewer/mcp-server/dist/index.js"]
    }
  }
}
```

Or add to project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "usv": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
```

## Available Tools

### `list_sessions`
List sessions with filtering by project, date range, or analysis status.

```json
{
  "project": "cleanStateVdash",
  "analyzed_only": true,
  "date_from": "2025-12-01",
  "limit": 20
}
```

### `search_sessions`
Full-text search using FTS5 (supports AND, OR, NOT, "phrases").

```json
{
  "query": "ray cluster setup",
  "limit": 10
}
```

### `get_session`
Get detailed session info including metadata, analysis, and continuation info.

```json
{
  "session_id": "7a4fac98-094d-4a59-b3fb-d4816f9f204f"
}
```

### `get_session_content`
Read raw messages from a session's JSONL file.

```json
{
  "session_id": "7a4fac98-094d-4a59-b3fb-d4816f9f204f",
  "message_limit": 50,
  "include_system": false
}
```

### `search_content`
Regex search within session message content (ripgrep-style).

```json
{
  "pattern": "192\\.168\\.68\\.59",
  "project": "vectorbt",
  "limit": 5
}
```

### `get_continuation_chain`
Get the full conversation chain for multi-session conversations.

```json
{
  "session_id": "any-session-in-chain"
}
```

### `list_projects`
List all projects with session counts and date ranges.

```json
{
  "include_stats": true
}
```

### `get_recent_activity`
Get recently active sessions grouped by project.

```json
{
  "days": 7,
  "limit": 5
}
```

## Example Workflows

### Find conversations about a topic
1. Use `search_sessions` with your query
2. Get details with `get_session`
3. Read content with `get_session_content`

### Explore recent work on a project
1. Use `get_recent_activity` to see recent sessions
2. Filter with `list_sessions` for specific project
3. Trace conversation chains with `get_continuation_chain`

### Find specific implementation details
1. Use `search_content` with regex pattern
2. Get matching session details
3. Read full conversation context
