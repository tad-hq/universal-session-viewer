# Changelog

All notable changes to Universal Session Viewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2025-12-22

### Added
- Initial public open source release
- AI-powered session summaries via Claude CLI integration
- SQLite FTS5 full-text search across all sessions
- Continuation chain tracking and visualization
- Vim-style keyboard navigation (j/k, gg, G, /)
- Real-time file watching for new Claude Code sessions
- Session resume functionality (opens terminal with claude code resume command)
- Zustand state management for React components
- Electron 28 with secure context isolation
- Go backend for LLM analysis (multi-platform binaries)
- Professional README with feature table, architecture diagram, and star history
- AGPL-3.0 license for open source distribution
- Comprehensive CHANGELOG following Keep a Changelog format

### Fixed
- Prompt file path command substitution for resume functionality
- Continuation count display via reordered fallback priority
- Continuation filter now loads complete chain (not just direct descendants)
- Resume and tmux functionality (4 critical bugs resolved)
- Bulk analysis pipeline (3 critical fixes)

### Changed
- License: AGPL-3.0 (enforces open source derivative works)
- Repository: Migrated to tad-hq organization

## [1.0.0] - 2025-12-18

### Added
- **AI-Powered Summaries**: LLM-generated session summaries via Claude CLI and Go backend
- **FTS5 Full-Text Search**: SQLite-powered instant search across thousands of sessions
- **Smart Caching**: SHA-256 hash-based cache invalidation for analysis results
- **Real-time Updates**: File watching detects new sessions as they're created
- **Continuation Chains**: Track related sessions across multiple conversations
- **Session Resume**: Continue any session directly in your terminal
- **Keyboard Navigation**: Vim-style shortcuts (j/k, gg, G, /) for power users
- **Smart Filtering**: Filter by project, date range, or continuation chains
- **Infinite Scroll**: Efficient pagination for large session libraries (1000+)
- Electron 28 desktop application
- React 18 frontend with TypeScript 5.3
- Tailwind CSS + shadcn/ui component library
- Zustand state management
- Go backend for LLM analysis
- SQLite database with FTS5 full-text search
- Comprehensive test suite with Vitest and Playwright

### Technical Details
- Multi-process architecture with secure context isolation
- IPC bridge via preload script for renderer-main communication
- File watcher with race condition prevention (awaitWriteFinish)
- Renderer-ready handshake to prevent data loss on startup
- Two-table database pattern (metadata + analysis cache)

[Unreleased]: https://github.com/tad-hq/universal-session-viewer/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/tad-hq/universal-session-viewer/releases/tag/v2.0.0
[1.0.0]: https://github.com/tad-hq/universal-session-viewer/releases/tag/v1.0.0
