# Universal Session Viewer

<p align="center">
  <img src="docs/images/app-icon.png" alt="Universal Session Viewer" width="128" height="128">
</p>

<p align="center">
  <strong>Browse, search, and analyze your Claude Code conversations with AI-powered summaries</strong>
</p>

<p align="center">
  <a href="https://github.com/tad-hq/universal-session-viewer/actions/workflows/ci.yml"><img src="https://github.com/tad-hq/universal-session-viewer/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/tad-hq/universal-session-viewer/actions/workflows/e2e.yml"><img src="https://github.com/tad-hq/universal-session-viewer/actions/workflows/e2e.yml/badge.svg" alt="E2E Tests"></a>
  <a href="https://github.com/tad-hq/universal-session-viewer/releases"><img src="https://img.shields.io/github/v/release/tad-hq/universal-session-viewer?include_prereleases&label=version" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License: AGPL-3.0"></a>
</p>

<p align="center">
  <a href="https://electronjs.org/"><img src="https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white" alt="Electron"></a>
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://go.dev/"><img src="https://img.shields.io/badge/Go-1.21-00ADD8?logo=go&logoColor=white" alt="Go"></a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-demo">Demo</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## Overview

Universal Session Viewer gives you instant access to all your Claude Code sessions stored in `~/.claude/projects/`. Find any conversation in seconds with full-text search, filter by project or date, and get **AI-generated summaries** of what was accomplished. Built for developers who want to revisit past sessions, understand their coding history, or quickly resume where they left off.

<p align="center">
  <img src="docs/images/screenshot.png" alt="Universal Session Viewer Screenshot" width="800">
</p>

---

## Demo

<p align="center">
  <img src="docs/images/demo.gif" alt="Universal Session Viewer Demo" width="700">
</p>

---

## Features

| Feature                   | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| **AI-Powered Summaries**  | LLM-generated session summaries via Claude CLI and Go backend |
| **FTS5 Full-Text Search** | SQLite-powered instant search across thousands of sessions    |
| **Smart Caching**         | SHA-256 hash-based cache invalidation for analysis results    |
| **Real-time Updates**     | File watching detects new sessions as they're created         |
| **Continuation Chains**   | Track related sessions across multiple conversations          |
| **Session Resume**        | Continue any session directly in your terminal                |
| **Keyboard Navigation**   | Vim-style shortcuts (j/k, gg, G, /) for power users           |
| **Smart Filtering**       | Filter by project, date range, or continuation chains         |
| **Infinite Scroll**       | Efficient pagination for large session libraries (1000+)      |

### Keyboard Shortcuts

| Key       | Action           |
| --------- | ---------------- |
| `j` / `↓` | Next session     |
| `k` / `↑` | Previous session |
| `/`       | Focus search     |
| `gg`      | Jump to first    |
| `G`       | Jump to last     |
| `,`       | Open settings    |
| `Esc`     | Clear/Close      |

---

## Installation

### macOS

**[Download the latest release](https://github.com/tad-hq/universal-session-viewer/releases/latest)** - choose the DMG for your Mac:
- `*-arm64.dmg` for Apple Silicon (M1/M2/M3/M4)
- `*-x64.dmg` for Intel Macs

**⚠️ Important: Unsigned Build**

Since this app is not notarized by Apple, you must bypass Gatekeeper on first launch:

1. Open the DMG and drag the app to Applications
2. **Right-click** the app in Applications → **Open** (don't double-click!)
3. Click **"Open"** in the security dialog
4. App will launch normally on subsequent opens

**Alternative method:**

```bash
# Remove quarantine attribute after installing
xattr -cr /Applications/Universal\ Session\ Viewer.app
```

**Why unsigned?** Code signing/notarization requires a $99/year Apple Developer account. We prioritize keeping this project free and open source.

### Windows

**[Download the latest release](https://github.com/tad-hq/universal-session-viewer/releases/latest)** - choose your format:
- `.exe` - installer
- `.zip` - portable

### Linux

**[Download the latest release](https://github.com/tad-hq/universal-session-viewer/releases/latest)** - choose your format:
- `.AppImage` - portable, run anywhere
- `.deb` - for Debian/Ubuntu

**AppImage:**

```bash
chmod +x Universal.Session.Viewer-*.AppImage
./Universal.Session.Viewer-*.AppImage
```

**Debian/Ubuntu:**

```bash
sudo dpkg -i universal-session-viewer_*_amd64.deb
```

### Requirements

- **macOS:** 10.15 (Catalina) or later
- **Windows:** Windows 10 or later
- **Linux:** Ubuntu 20.04+ or equivalent
- **Claude Code:** Installed with sessions in `~/.claude/projects/`

### Build from Source

**Prerequisites**: Node.js 18+, Go 1.21+, macOS

```bash
# Clone the repository
git clone https://github.com/tad-hq/universal-session-viewer.git
cd universal-session-viewer

# Install dependencies
npm install

# Build the Go backend (required for AI summaries)
cd go-backend && ./build.sh && cd ..

# Start development mode
npm run electron:dev
```

### Build for Distribution

```bash
# Production build
npm run build

# Package for macOS (signed)
npm run build:mac

# Package without code signing (local testing)
npm run build:mac:unsigned
```

---

## Usage

### Quick Start

1. **Launch the app** - Sessions from `~/.claude/projects/` are auto-discovered
2. **Search** - Type in search box or press `/`
3. **Navigate** - Use `j`/`k` or arrow keys
4. **View details** - Click any session to see full conversation
5. **Resume** - Click "Resume Session" to continue in terminal

### Filtering

| Filter           | Options                                              |
| ---------------- | ---------------------------------------------------- |
| **Project**      | Dropdown to select specific project                  |
| **Date**         | Today, This Week, This Month, This Quarter, All Time |
| **Continuation** | Filter by continuation chain                         |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   SQLite    │  │    File     │  │    Go Backend       │  │
│  │  FTS5 DB    │  │   Watcher   │  │  (LLM Analysis)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ IPC Bridge (Preload)
┌────────────────────────┴────────────────────────────────────┐
│                   Electron Renderer Process                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    React    │  │   Zustand   │  │   Tailwind CSS      │  │
│  │     18      │  │   Stores    │  │   + shadcn/ui       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer        | Technology                                        |
| ------------ | ------------------------------------------------- |
| **Desktop**  | Electron 28                                       |
| **Frontend** | React 18, TypeScript 5.3, Tailwind CSS, shadcn/ui |
| **State**    | Zustand                                           |
| **Database** | SQLite (better-sqlite3) with FTS5                 |
| **Backend**  | Go 1.21 (LLM analysis via Claude CLI)             |
| **Build**    | Vite 5, electron-builder                          |

---

## Development

```bash
# Development with hot reload
npm run electron:dev

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Run tests
npm test
npm run test:e2e
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/universal-session-viewer.git

# Create feature branch
git checkout -b feature/your-feature

# Make changes, then
npm run lint
npm run typecheck
npm test

# Submit PR
```

---

## Roadmap

- [x] Windows support
- [x] Linux support
- [ ] Homebrew distribution
- [ ] Session bookmarks
- [ ] Export conversations
- [ ] Custom themes

---

## Star History

<a href="https://star-history.com/#tad-hq/universal-session-viewer&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=tad-hq/universal-session-viewer&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=tad-hq/universal-session-viewer&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=tad-hq/universal-session-viewer&type=Date" />
 </picture>
</a>

---

## License

[AGPL-3.0](LICENSE) - Created by [Tad Schnitzer](https://github.com/tad-hq)

---

<p align="center">
  <a href="https://github.com/tad-hq/universal-session-viewer/issues/new?template=bug_report.yml">Report Bug</a> •
  <a href="https://github.com/tad-hq/universal-session-viewer/issues/new?template=feature_request.yml">Request Feature</a> •
  <a href="https://github.com/tad-hq/universal-session-viewer/discussions">Discussions</a>
</p>
