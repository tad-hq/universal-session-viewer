#!/usr/bin/env node
/**
 * Universal Session Viewer MCP Server
 *
 * Provides tools for agents to query Claude Code sessions:
 * - list_sessions: List sessions with filtering
 * - search_sessions: Full-text search using FTS5
 * - get_session: Get session metadata and analysis
 * - get_session_content: Read raw session messages
 * - search_content: Search within session messages (ripgrep-style)
 * - get_continuation_chain: Get full conversation chain
 * - list_projects: List all available projects
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Database path
const DB_PATH = path.join(
  os.homedir(),
  ".universal-session-viewer",
  "session-cache.db"
);
const CLAUDE_PROJECTS_PATH = path.join(os.homedir(), ".claude", "projects");

// Types
interface SessionMetadata {
  session_id: string;
  project_name: string;
  project_path: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  file_modified_time: number;
  message_count: number;
  first_message_time: number | string | null;
  last_message_time: number | string | null;
  session_duration_seconds: number | null;
  is_analyzed: number;
  is_valid: number;
  is_empty: number;
}

interface SessionAnalysis {
  session_id: string;
  title: string | null;
  summary: string;
  analysis_model: string;
  analysis_timestamp: number;
  messages_analyzed: number;
}

interface ContinuationInfo {
  child_session_id: string;
  parent_session_id: string;
  continuation_order: number;
  is_active_continuation: number;
}

interface SessionMessage {
  type: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
  sessionId?: string;
}

// Initialize database connection
function getDatabase(): Database.Database {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}. Run Universal Session Viewer first.`);
  }
  return new Database(DB_PATH, { readonly: true });
}

// Tool definitions
const tools = [
  {
    name: "list_sessions",
    description:
      "List Claude Code sessions with optional filtering by project, date range, or analysis status. Returns session metadata including title, summary, project, and timestamps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: {
          type: "string",
          description: "Filter by project path (partial match supported)",
        },
        analyzed_only: {
          type: "boolean",
          description: "Only return sessions that have been analyzed",
        },
        date_from: {
          type: "string",
          description: "Filter sessions modified after this ISO date",
        },
        date_to: {
          type: "string",
          description: "Filter sessions modified before this ISO date",
        },
        limit: {
          type: "number",
          description: "Maximum number of sessions to return (default: 50)",
        },
        offset: {
          type: "number",
          description: "Number of sessions to skip (for pagination)",
        },
      },
    },
  },
  {
    name: "search_sessions",
    description:
      "Full-text search across session titles, summaries, and project paths using FTS5. Returns matching sessions ranked by relevance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (supports FTS5 syntax: AND, OR, NOT, phrases)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_session",
    description:
      "Get detailed information about a specific session including metadata, analysis (title/summary), and continuation chain info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The session UUID to retrieve",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "get_session_content",
    description:
      "Read the raw messages from a session's JSONL file. Returns user and assistant messages with timestamps. Use for deep analysis of conversation content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The session UUID to read content from",
        },
        message_limit: {
          type: "number",
          description: "Maximum number of messages to return (default: 100)",
        },
        include_system: {
          type: "boolean",
          description: "Include system/tool messages (default: false, only user/assistant)",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "search_content",
    description:
      "Search within session message content using regex patterns. Similar to ripgrep search across JSONL files. Returns matching sessions and message snippets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Regex pattern to search for in message content",
        },
        project: {
          type: "string",
          description: "Limit search to specific project path (partial match)",
        },
        limit: {
          type: "number",
          description: "Maximum number of matching sessions (default: 10)",
        },
        context_lines: {
          type: "number",
          description: "Number of context characters around matches (default: 200)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "get_continuation_chain",
    description:
      "Get the full continuation chain for a session. Returns the root session and all child continuations in order, useful for understanding long conversations that span multiple sessions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "Any session ID in the chain (will find root and all children)",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "list_projects",
    description:
      "List all projects with session counts and date ranges. Useful for discovering what projects are available for analysis.",
    inputSchema: {
      type: "object" as const,
      properties: {
        include_stats: {
          type: "boolean",
          description: "Include session count and date stats per project (default: true)",
        },
      },
    },
  },
  {
    name: "get_recent_activity",
    description:
      "Get recently active sessions grouped by project. Useful for understanding current work context and finding recent conversations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default: 7)",
        },
        limit: {
          type: "number",
          description: "Maximum sessions per project (default: 5)",
        },
      },
    },
  },
];

// Tool implementations
function listSessions(args: {
  project?: string;
  analyzed_only?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): string {
  const db = getDatabase();
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;

  let query = `
    SELECT
      m.session_id,
      m.project_name,
      m.project_path,
      m.file_modified_time,
      m.message_count,
      m.is_analyzed,
      a.title,
      a.summary,
      a.analysis_timestamp
    FROM session_metadata m
    LEFT JOIN session_analysis_cache a ON m.session_id = a.session_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (args.project) {
    query += ` AND m.project_path LIKE ?`;
    params.push(`%${args.project}%`);
  }

  if (args.analyzed_only) {
    query += ` AND m.is_analyzed = 1`;
  }

  if (args.date_from) {
    const timestamp = new Date(args.date_from).getTime() / 1000;
    query += ` AND m.file_modified_time >= ?`;
    params.push(timestamp);
  }

  if (args.date_to) {
    const timestamp = new Date(args.date_to).getTime() / 1000;
    query += ` AND m.file_modified_time <= ?`;
    params.push(timestamp);
  }

  query += ` ORDER BY m.file_modified_time DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const sessions = db.prepare(query).all(...params);

  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM session_metadata m WHERE 1=1`;
  const countParams: (string | number)[] = [];

  if (args.project) {
    countQuery += ` AND m.project_path LIKE ?`;
    countParams.push(`%${args.project}%`);
  }
  if (args.analyzed_only) {
    countQuery += ` AND m.is_analyzed = 1`;
  }

  const total = (db.prepare(countQuery).get(...countParams) as { total: number }).total;

  db.close();

  return JSON.stringify(
    {
      sessions: sessions.map((s: unknown) => {
        const session = s as SessionMetadata & Partial<SessionAnalysis>;
        return {
          id: session.session_id,
          project: session.project_name,
          project_path: session.project_path,
          title: session.title || "(Not analyzed)",
          summary: session.summary
            ? session.summary.substring(0, 200) + (session.summary.length > 200 ? "..." : "")
            : null,
          message_count: session.message_count,
          modified: new Date((session.file_modified_time || 0) * 1000).toISOString(),
          is_analyzed: Boolean(session.is_analyzed),
        };
      }),
      total,
      limit,
      offset,
      has_more: offset + sessions.length < total,
    },
    null,
    2
  );
}

function searchSessions(args: { query: string; limit?: number }): string {
  const db = getDatabase();
  const limit = args.limit ?? 20;

  // FTS5 search
  const query = `
    SELECT
      f.session_id,
      f.title,
      f.summary,
      f.project_path,
      m.project_name,
      m.file_modified_time,
      m.message_count,
      highlight(session_fts, 1, '**', '**') as title_highlight,
      highlight(session_fts, 2, '**', '**') as summary_highlight,
      bm25(session_fts) as rank
    FROM session_fts f
    JOIN session_metadata m ON f.session_id = m.session_id
    WHERE session_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `;

  try {
    const results = db.prepare(query).all(args.query, limit);
    db.close();

    return JSON.stringify(
      {
        query: args.query,
        results: results.map((r: unknown) => {
          const result = r as SessionMetadata &
            SessionAnalysis & {
              title_highlight: string;
              summary_highlight: string;
              rank: number;
            };
          return {
            session_id: result.session_id,
            project: result.project_name,
            project_path: result.project_path,
            title: result.title_highlight || result.title,
            summary_snippet: result.summary_highlight
              ? result.summary_highlight.substring(0, 300)
              : result.summary?.substring(0, 300),
            modified: new Date((result.file_modified_time || 0) * 1000).toISOString(),
            relevance_score: -result.rank,
          };
        }),
        total: results.length,
      },
      null,
      2
    );
  } catch (error) {
    db.close();
    return JSON.stringify({
      error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      hint: "FTS5 supports: AND, OR, NOT, 'exact phrase', prefix*",
    });
  }
}

function getSession(args: { session_id: string }): string {
  const db = getDatabase();

  const metadata = db
    .prepare(
      `
    SELECT * FROM session_metadata WHERE session_id = ?
  `
    )
    .get(args.session_id) as SessionMetadata | undefined;

  if (!metadata) {
    db.close();
    return JSON.stringify({ error: `Session not found: ${args.session_id}` });
  }

  const analysis = db
    .prepare(
      `
    SELECT * FROM session_analysis_cache WHERE session_id = ?
  `
    )
    .get(args.session_id) as SessionAnalysis | undefined;

  // Check for continuations
  const parentLink = db
    .prepare(
      `
    SELECT parent_session_id, continuation_order
    FROM session_continuations
    WHERE child_session_id = ?
  `
    )
    .get(args.session_id) as { parent_session_id: string; continuation_order: number } | undefined;

  const children = db
    .prepare(
      `
    SELECT child_session_id, continuation_order
    FROM session_continuations
    WHERE parent_session_id = ?
    ORDER BY continuation_order
  `
    )
    .all(args.session_id) as Array<{ child_session_id: string; continuation_order: number }>;

  db.close();

  return JSON.stringify(
    {
      session_id: metadata.session_id,
      project: {
        name: metadata.project_name,
        path: metadata.project_path,
      },
      file: {
        path: metadata.file_path,
        name: metadata.file_name,
        size: metadata.file_size,
        modified: metadata.file_modified_time
          ? new Date(metadata.file_modified_time * 1000).toISOString()
          : null,
      },
      content: {
        message_count: metadata.message_count,
        first_message: metadata.first_message_time
          ? (typeof metadata.first_message_time === 'string'
              ? metadata.first_message_time
              : new Date(metadata.first_message_time * 1000).toISOString())
          : null,
        last_message: metadata.last_message_time
          ? (typeof metadata.last_message_time === 'string'
              ? metadata.last_message_time
              : new Date(metadata.last_message_time * 1000).toISOString())
          : null,
        duration_seconds: metadata.session_duration_seconds,
      },
      analysis: analysis
        ? {
            title: analysis.title,
            summary: analysis.summary,
            model: analysis.analysis_model,
            analyzed_at: analysis.analysis_timestamp
              ? new Date(analysis.analysis_timestamp * 1000).toISOString()
              : null,
            messages_analyzed: analysis.messages_analyzed,
          }
        : null,
      continuation: {
        is_continuation: Boolean(parentLink),
        parent_session_id: parentLink?.parent_session_id || null,
        has_children: children.length > 0,
        child_session_ids: children.map((c) => c.child_session_id),
      },
    },
    null,
    2
  );
}

function getSessionContent(args: {
  session_id: string;
  message_limit?: number;
  include_system?: boolean;
}): string {
  const db = getDatabase();
  const limit = args.message_limit ?? 100;
  const includeSystem = args.include_system ?? false;

  const metadata = db
    .prepare(`SELECT file_path FROM session_metadata WHERE session_id = ?`)
    .get(args.session_id) as { file_path: string } | undefined;

  db.close();

  if (!metadata) {
    return JSON.stringify({ error: `Session not found: ${args.session_id}` });
  }

  if (!fs.existsSync(metadata.file_path)) {
    return JSON.stringify({ error: `Session file not found: ${metadata.file_path}` });
  }

  const content = fs.readFileSync(metadata.file_path, "utf-8");
  const lines = content.trim().split("\n");

  const messages: Array<{
    type: string;
    role?: string;
    timestamp?: string;
    content: string;
  }> = [];

  for (const line of lines) {
    if (messages.length >= limit) break;

    try {
      const event = JSON.parse(line) as SessionMessage;

      // Filter by message type
      if (event.type === "user" || event.type === "assistant") {
        const role = event.type;
        let textContent = "";

        if (event.message?.content) {
          if (typeof event.message.content === "string") {
            textContent = event.message.content;
          } else if (Array.isArray(event.message.content)) {
            textContent = event.message.content
              .filter((c) => c.type === "text")
              .map((c) => c.text || "")
              .join("\n");
          }
        }

        if (textContent) {
          messages.push({
            type: event.type,
            role,
            timestamp: event.timestamp,
            content: textContent,
          });
        }
      } else if (includeSystem && (event.type === "tool_use" || event.type === "tool_result")) {
        messages.push({
          type: event.type,
          timestamp: event.timestamp,
          content: JSON.stringify(event).substring(0, 500),
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return JSON.stringify(
    {
      session_id: args.session_id,
      file_path: metadata.file_path,
      total_lines: lines.length,
      messages_returned: messages.length,
      messages,
    },
    null,
    2
  );
}

function searchContent(args: {
  pattern: string;
  project?: string;
  limit?: number;
  context_lines?: number;
}): string {
  const db = getDatabase();
  const limit = args.limit ?? 10;
  const contextChars = args.context_lines ?? 200;

  let query = `SELECT session_id, file_path, project_path, project_name FROM session_metadata WHERE 1=1`;
  const params: string[] = [];

  if (args.project) {
    query += ` AND project_path LIKE ?`;
    params.push(`%${args.project}%`);
  }

  const sessions = db.prepare(query).all(...params) as Array<{
    session_id: string;
    file_path: string;
    project_path: string;
    project_name: string;
  }>;
  db.close();

  const regex = new RegExp(args.pattern, "gi");
  const results: Array<{
    session_id: string;
    project: string;
    project_path: string;
    matches: Array<{ line: number; context: string }>;
  }> = [];

  for (const session of sessions) {
    if (results.length >= limit) break;

    if (!fs.existsSync(session.file_path)) continue;

    try {
      const content = fs.readFileSync(session.file_path, "utf-8");
      const lines = content.split("\n");
      const matches: Array<{ line: number; context: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = regex.exec(line);

        if (match) {
          const start = Math.max(0, match.index - contextChars);
          const end = Math.min(line.length, match.index + match[0].length + contextChars);
          const context = (start > 0 ? "..." : "") + line.substring(start, end) + (end < line.length ? "..." : "");

          matches.push({ line: i + 1, context });

          if (matches.length >= 3) break; // Max 3 matches per file
        }
        regex.lastIndex = 0; // Reset regex for next line
      }

      if (matches.length > 0) {
        results.push({
          session_id: session.session_id,
          project: session.project_name,
          project_path: session.project_path,
          matches,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return JSON.stringify(
    {
      pattern: args.pattern,
      project_filter: args.project || null,
      results,
      total_matches: results.length,
    },
    null,
    2
  );
}

function getContinuationChain(args: { session_id: string }): string {
  const db = getDatabase();

  // Find root using recursive CTE
  const rootQuery = `
    WITH RECURSIVE chain AS (
      SELECT child_session_id, parent_session_id, 1 as depth
      FROM session_continuations
      WHERE child_session_id = ?

      UNION ALL

      SELECT c.child_session_id, c.parent_session_id, chain.depth + 1
      FROM session_continuations c
      JOIN chain ON c.child_session_id = chain.parent_session_id
    )
    SELECT parent_session_id as root_id
    FROM chain
    ORDER BY depth DESC
    LIMIT 1
  `;

  const rootResult = db.prepare(rootQuery).get(args.session_id) as { root_id: string } | undefined;

  // If no parent found, this session might be the root
  const rootId = rootResult?.root_id || args.session_id;

  // Check if this session is actually a root (has children)
  const hasChildren = db
    .prepare(`SELECT 1 FROM session_continuations WHERE parent_session_id = ? LIMIT 1`)
    .get(rootId);

  const isInChain = db
    .prepare(`SELECT 1 FROM session_continuations WHERE child_session_id = ? OR parent_session_id = ? LIMIT 1`)
    .get(args.session_id, args.session_id);

  if (!isInChain && !hasChildren) {
    // Standalone session
    const metadata = db
      .prepare(
        `
      SELECT m.*, a.title, a.summary
      FROM session_metadata m
      LEFT JOIN session_analysis_cache a ON m.session_id = a.session_id
      WHERE m.session_id = ?
    `
      )
      .get(args.session_id) as (SessionMetadata & Partial<SessionAnalysis>) | undefined;

    db.close();

    if (!metadata) {
      return JSON.stringify({ error: `Session not found: ${args.session_id}` });
    }

    return JSON.stringify(
      {
        chain_type: "standalone",
        root_session_id: args.session_id,
        sessions: [
          {
            session_id: metadata.session_id,
            position: 0,
            project: metadata.project_name,
            title: metadata.title || "(Not analyzed)",
            modified: new Date(metadata.file_modified_time * 1000).toISOString(),
          },
        ],
        total_sessions: 1,
      },
      null,
      2
    );
  }

  // Get full chain from root
  const chainQuery = `
    WITH RECURSIVE full_chain AS (
      -- Start with root
      SELECT ? as session_id, 0 as position

      UNION ALL

      -- Add children
      SELECT c.child_session_id, full_chain.position + 1
      FROM session_continuations c
      JOIN full_chain ON c.parent_session_id = full_chain.session_id
    )
    SELECT
      fc.session_id,
      fc.position,
      m.project_name,
      m.file_modified_time,
      a.title,
      a.summary
    FROM full_chain fc
    JOIN session_metadata m ON fc.session_id = m.session_id
    LEFT JOIN session_analysis_cache a ON fc.session_id = a.session_id
    ORDER BY fc.position
  `;

  const chain = db.prepare(chainQuery).all(rootId) as Array<{
    session_id: string;
    position: number;
    project_name: string;
    file_modified_time: number;
    title: string | null;
    summary: string | null;
  }>;

  db.close();

  return JSON.stringify(
    {
      chain_type: "continuation",
      root_session_id: rootId,
      queried_session_id: args.session_id,
      sessions: chain.map((s) => ({
        session_id: s.session_id,
        position: s.position,
        is_queried: s.session_id === args.session_id,
        project: s.project_name,
        title: s.title || "(Not analyzed)",
        summary_snippet: s.summary?.substring(0, 150) || null,
        modified: new Date(s.file_modified_time * 1000).toISOString(),
      })),
      total_sessions: chain.length,
    },
    null,
    2
  );
}

function listProjects(args: { include_stats?: boolean }): string {
  const db = getDatabase();
  const includeStats = args.include_stats ?? true;

  let query: string;

  if (includeStats) {
    query = `
      SELECT
        project_path,
        project_name,
        COUNT(*) as session_count,
        SUM(CASE WHEN is_analyzed = 1 THEN 1 ELSE 0 END) as analyzed_count,
        MIN(file_modified_time) as first_session,
        MAX(file_modified_time) as last_session
      FROM session_metadata
      WHERE project_path IS NOT NULL
      GROUP BY project_path
      ORDER BY last_session DESC
    `;
  } else {
    query = `
      SELECT DISTINCT project_path, project_name
      FROM session_metadata
      WHERE project_path IS NOT NULL
      ORDER BY project_name
    `;
  }

  const projects = db.prepare(query).all() as Array<{
    project_path: string;
    project_name: string;
    session_count?: number;
    analyzed_count?: number;
    first_session?: number;
    last_session?: number;
  }>;

  db.close();

  return JSON.stringify(
    {
      projects: projects.map((p) => ({
        path: p.project_path,
        name: p.project_name,
        ...(includeStats && {
          session_count: p.session_count,
          analyzed_count: p.analyzed_count,
          first_session: p.first_session
            ? new Date(p.first_session * 1000).toISOString()
            : null,
          last_session: p.last_session
            ? new Date(p.last_session * 1000).toISOString()
            : null,
        }),
      })),
      total: projects.length,
    },
    null,
    2
  );
}

function getRecentActivity(args: { days?: number; limit?: number }): string {
  const db = getDatabase();
  const days = args.days ?? 7;
  const limitPerProject = args.limit ?? 5;

  const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const query = `
    WITH ranked AS (
      SELECT
        m.session_id,
        m.project_path,
        m.project_name,
        m.file_modified_time,
        m.message_count,
        a.title,
        a.summary,
        ROW_NUMBER() OVER (PARTITION BY m.project_path ORDER BY m.file_modified_time DESC) as rn
      FROM session_metadata m
      LEFT JOIN session_analysis_cache a ON m.session_id = a.session_id
      WHERE m.file_modified_time >= ?
    )
    SELECT * FROM ranked WHERE rn <= ?
    ORDER BY file_modified_time DESC
  `;

  const sessions = db.prepare(query).all(cutoffTime, limitPerProject) as Array<{
    session_id: string;
    project_path: string;
    project_name: string;
    file_modified_time: number;
    message_count: number;
    title: string | null;
    summary: string | null;
    rn: number;
  }>;

  db.close();

  // Group by project
  const byProject: Record<
    string,
    {
      project_name: string;
      sessions: Array<{
        session_id: string;
        title: string | null;
        modified: string;
        message_count: number;
      }>;
    }
  > = {};

  for (const s of sessions) {
    if (!byProject[s.project_path]) {
      byProject[s.project_path] = {
        project_name: s.project_name,
        sessions: [],
      };
    }
    byProject[s.project_path].sessions.push({
      session_id: s.session_id,
      title: s.title || "(Not analyzed)",
      modified: new Date(s.file_modified_time * 1000).toISOString(),
      message_count: s.message_count,
    });
  }

  return JSON.stringify(
    {
      days_back: days,
      cutoff_date: new Date(cutoffTime * 1000).toISOString(),
      projects: Object.entries(byProject).map(([path, data]) => ({
        path,
        name: data.project_name,
        recent_sessions: data.sessions,
      })),
      total_active_projects: Object.keys(byProject).length,
      total_recent_sessions: sessions.length,
    },
    null,
    2
  );
}

// Main server setup
const server = new Server(
  {
    name: "universal-session-viewer",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "list_sessions":
        result = listSessions(args as Parameters<typeof listSessions>[0]);
        break;
      case "search_sessions":
        result = searchSessions(args as Parameters<typeof searchSessions>[0]);
        break;
      case "get_session":
        result = getSession(args as Parameters<typeof getSession>[0]);
        break;
      case "get_session_content":
        result = getSessionContent(args as Parameters<typeof getSessionContent>[0]);
        break;
      case "search_content":
        result = searchContent(args as Parameters<typeof searchContent>[0]);
        break;
      case "get_continuation_chain":
        result = getContinuationChain(args as Parameters<typeof getContinuationChain>[0]);
        break;
      case "list_projects":
        result = listProjects(args as Parameters<typeof listProjects>[0]);
        break;
      case "get_recent_activity":
        result = getRecentActivity(args as Parameters<typeof getRecentActivity>[0]);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Universal Session Viewer MCP server running on stdio");
}

main().catch(console.error);
