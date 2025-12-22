# Getting Support

Thanks for using Universal Session Viewer! This document explains how to get help.

## Before Asking for Help

Please try these resources first:

1. **[README](README.md)** - Installation, usage, and quick start
2. **[FAQ](#frequently-asked-questions)** - Common questions answered below
3. **[Documentation](CLAUDE.md)** - Detailed guides and architecture
4. **[Search Discussions](https://github.com/tadschnitzer/universal-session-viewer/discussions)** - Someone may have asked your question

## How to Get Help

### Questions & General Support

For questions about using Universal Session Viewer:

**[Ask in GitHub Discussions (Q&A)](https://github.com/tadschnitzer/universal-session-viewer/discussions/categories/q-a)**

Please include:
- What you're trying to do
- What you've already tried
- Your environment (OS version, app version)
- Any error messages

### Bug Reports

If you've found a bug:

**[Open an Issue](https://github.com/tadschnitzer/universal-session-viewer/issues/new?template=bug_report.yml)**

Please use the bug report template and include reproduction steps.

### Feature Requests

Have an idea for improvement?

**[Start an Ideas Discussion](https://github.com/tadschnitzer/universal-session-viewer/discussions/categories/ideas)**

Share your use case and proposed solution.

### Security Vulnerabilities

**Do NOT open a public issue for security vulnerabilities.**

See [SECURITY.md](SECURITY.md) for how to report security issues privately.

## Response Times

This is a solo-maintained open source project. Please be patient!

| Channel | Expected Response |
|---------|-------------------|
| Security issues | Within 48 hours |
| Bug reports | Within 1 week |
| Questions | Best effort (community may answer faster) |
| Feature requests | Reviewed monthly |

## Support Tiers

| Tier | Channel | Who Responds |
|------|---------|--------------|
| Self-Service | README, FAQ, Docs | You! |
| Community | Discussions | Community + Maintainers |
| Maintainer | Issues | Maintainers |
| Security | SECURITY.md | Maintainers (private) |

---

## Frequently Asked Questions

### Installation & Setup

#### Q: What are the system requirements?

**A:**
- macOS 11 (Big Sur) or later
- Node.js 18+ for development
- Claude Code installed (`~/.claude/` directory must exist)

#### Q: The app shows "No sessions found"

**A:** This happens when:
1. Claude Code isn't installed or hasn't been used
2. The `~/.claude/projects/` directory doesn't exist
3. You haven't had any Claude Code conversations yet

**Solution:** Start a Claude Code conversation in any directory, then restart the viewer.

#### Q: How do I update to a new version?

**A:**
- **If downloaded from releases:** Download the new version and replace the old one
- **If building from source:** `git pull && npm install && npm run build:mac`

The app has auto-update capability if you're using signed builds.

### Usage

#### Q: How do I search across all sessions?

**A:** Use the search box at the top of the sidebar. It searches:
- Session names
- AI-generated summaries
- Full session content (via FTS5)

Press `/` to quickly focus the search box.

#### Q: What's the "Resume Session" button do?

**A:** It opens a new terminal and starts Claude Code in the selected session. This lets you continue a conversation where you left off.

**Requirements:**
- Claude Code must be installed
- Terminal app must be configured (default: Terminal.app)

#### Q: Why does analysis take so long?

**A:** Session analysis uses an LLM to summarize conversations. This is CPU/API intensive. Tips:
- Analysis results are cached (second view is instant)
- Large sessions take longer to analyze
- The Go backend handles analysis asynchronously

#### Q: How do I change the keyboard shortcuts?

**A:** Currently, keyboard shortcuts are not configurable. Default shortcuts:
- `j/k` - Navigate sessions
- `/` - Focus search
- `gg` - Go to first session
- `G` - Go to last session

### Troubleshooting

#### Q: The app won't start / crashes on launch

**A:** Try these steps:
1. Make sure no other instance is running
2. Delete the cache: `rm -rf ~/.universal-session-viewer/session-cache.db`
3. If building from source: `npm run rebuild`
4. Check for errors in Console.app (search "Universal Session Viewer")

#### Q: Sessions are missing or outdated

**A:**
1. **Refresh manually:** Click the refresh button in the sidebar
2. **Check file watcher:** The app watches for changes, but may miss some. Restart the app.
3. **Clear cache:** Delete `~/.universal-session-viewer/session-cache.db` and restart

#### Q: Analysis shows "Failed" for a session

**A:** Analysis can fail if:
1. The session is very large (>100K tokens)
2. Network issues during LLM API call
3. Go backend errors

**Solution:** Try again later, or check the console for error messages.

### Development

#### Q: How do I build from source?

**A:**
```bash
git clone https://github.com/tadschnitzer/universal-session-viewer.git
cd universal-session-viewer
npm install
npm run rebuild
npm run electron:dev
```

#### Q: How do I run tests?

**A:**
```bash
npm test          # Unit tests
npm run test:e2e  # E2E tests (requires built app)
```

#### Q: Where is the database stored?

**A:** `~/.universal-session-viewer/session-cache.db` (SQLite)

#### Q: How do I build the Go backend?

**A:**
```bash
cd go-backend
./build.sh
```

This creates binaries in `bin/` directory.

---

## Still Need Help?

If you've read through this document and still need help:

1. **[Search existing Discussions](https://github.com/tadschnitzer/universal-session-viewer/discussions)** - Your question may be answered
2. **[Open a new Discussion](https://github.com/tadschnitzer/universal-session-viewer/discussions/new?category=q-a)** - We'll help!

Please don't open an Issue for support questions - use Discussions instead.

---

## Contributing to Support

Want to help improve support?

- **Answer questions** in Discussions
- **Suggest FAQ additions** via PR or Discussion
- **Improve documentation** for common issues
- **Report unclear docs** so we can fix them

Thank you for being part of the community!
