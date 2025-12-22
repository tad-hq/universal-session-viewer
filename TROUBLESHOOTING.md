# Troubleshooting Guide

Having trouble with Universal Session Viewer? This guide covers common issues and their solutions.

**Jump to:** [Quick Diagnostics](#quick-diagnostics) | [Sessions Issues](#sessions-issues) | [Search Issues](#search-issues) | [Performance](#performance-issues) | [Platform-Specific](#platform-specific-issues) | [Getting Help](#getting-help)

---

## Quick Diagnostics

Before diving into specific issues, run these quick checks:

1. **Check the basics**
   ```bash
   # Verify Claude Code is installed
   ls ~/.claude/projects/
   # Should show project directories with .jsonl files

   # Check app version
   # Help > About (shows version number)
   ```

2. **Check logs**
   - **macOS**: `~/Library/Logs/Universal Session Viewer/main.log`
   - **Windows**: `%APPDATA%\Universal Session Viewer\logs\main.log`
   - **Linux**: `~/.config/Universal Session Viewer/logs/main.log`

3. **Try a fresh start**
   - Quit the app completely (check system tray)
   - Restart the app
   - Wait 30 seconds for initialization

If issues persist, see specific problems below.

---

## Sessions Issues

### Sessions Not Loading or Appearing

**Symptoms:**
- Empty session list
- "No sessions found" message
- Session count shows 0

**Causes & Solutions:**

**1. Claude Code not installed or sessions don't exist**
```bash
# Check if sessions exist
ls -la ~/.claude/projects/

# Should show directories containing .jsonl files
# Example: ~/.claude/projects/my-project-abc123/session-xyz.jsonl
```

**Fix**: Install Claude Code and create at least one session.

**2. Permission issues**

The app needs read access to `~/.claude/projects/`.

```bash
# macOS/Linux: Check permissions
ls -la ~/.claude/

# Should show readable directories
# Fix: Grant read permissions
chmod -R 755 ~/.claude/projects/
```

**macOS**: If prompted for folder access, click "Allow" in System Settings.

**3. Database corruption**

Rare, but database may be corrupted.

```bash
# Delete the cache database (will rebuild automatically)
# macOS
rm ~/Library/Application\ Support/Universal\ Session\ Viewer/session-cache.db

# Windows
del "%APPDATA%\Universal Session Viewer\session-cache.db"

# Linux
rm ~/.config/Universal\ Session\ Viewer/session-cache.db
```

Restart the app - it will rebuild the index.

**4. File watching not working**

If new sessions don't appear automatically:
- Settings > Advanced > Restart File Watcher
- Or restart the entire app

---

### Sessions Show Incorrect Content

**Symptoms:**
- Session shows wrong messages
- Message count doesn't match file
- Duplicate messages appear

**Causes:**

**1. Stale cache**

Cache may be out of sync with actual files.

**Fix:**
```
Settings > Advanced > Rebuild Index
```

This re-scans all sessions (may take 1-2 minutes).

**2. Corrupted JSONL file**

The session file itself may have invalid JSON lines.

**Diagnostic:**
```bash
# Validate a session file manually
cd ~/.claude/projects/my-project-abc123/
cat session-xyz.jsonl | jq . > /dev/null

# If this shows errors, the file is corrupted
```

**Fix**: No automated fix - file must be manually repaired or Claude Code may need to be reinstalled.

---

## Search Issues

### Search Returns No Results

**Symptoms:**
- Typing in search box shows "No results"
- Known sessions don't appear in search

**Causes & Solutions:**

**1. Search index not built yet**

First launch takes 1-2 minutes to index all sessions.

**Check**: Look for "Indexing..." in status bar

**Fix**: Wait for indexing to complete.

**2. Search syntax issues**

Search uses SQLite FTS5 syntax:

```
# Valid searches:
authentication
"exact phrase"
auth AND login
auth OR security

# Invalid (won't work):
*auth   (wildcards at start not supported)
auth*   (partial words - use full words)
```

**3. Search index corruption**

Rebuild the search index:

```
Settings > Advanced > Rebuild Search Index
```

**4. Session hasn't been indexed**

Very new sessions (< 1 second old) may not be indexed yet.

**Fix**: Wait a few seconds, or manually refresh (Cmd/Ctrl + R).

---

## Performance Issues

### App is Slow or Freezing

**Symptoms:**
- UI lags when scrolling
- Search takes >5 seconds
- App freezes temporarily

**Causes:**

**1. Too many sessions (1000+)**

The app is optimized for up to 5000 sessions, but performance degrades with very large libraries.

**Check:**
```bash
# Count total sessions
find ~/.claude/projects/ -name "*.jsonl" | wc -l
```

**Fix**:
- Archive old sessions (move to a backup folder)
- Use project filter to narrow view
- Increase pagination limit: Settings > Display > Sessions per page

**2. Large session files**

Individual sessions with 1000+ messages can be slow to load.

**Check**: Look at message count in session list

**Fix**: No workaround - large sessions are inherently slow. Consider:
- Breaking up very long sessions
- Filtering messages in session view

**3. Analysis running in background**

LLM analysis can consume CPU.

**Check**: Activity Monitor/Task Manager shows high CPU for "Universal Session Viewer"

**Fix**:
- Wait for analysis to complete
- Disable auto-analysis: Settings > Analysis > Auto-analyze new sessions (off)

**4. Database locked**

Multiple instances of the app running.

**Check**:
```bash
# macOS/Linux
ps aux | grep "Universal Session Viewer"

# Windows
tasklist | findstr "Universal"
```

**Fix**: Quit all instances, reopen only one.

---

### High Memory Usage

**Symptoms:**
- App uses >500 MB RAM
- System becomes slow
- Memory warnings

**Causes:**

**1. Large number of sessions loaded**

Each loaded session consumes memory.

**Fix**:
- Use filters to reduce active session list
- Restart app to clear memory
- Close unused session detail views

**2. Memory leak (rare)**

If memory grows continuously without bounds:

**Report**: This is a bug - please file an issue with:
- Memory usage over time
- Number of sessions
- Operations performed

---

## Analysis Issues

### Analysis Features Not Working

**Symptoms:**
- "Analyze" button does nothing
- No summaries generated
- Analysis shows "Failed"

**Causes:**

**1. Go backend not built**

Analysis requires the Go backend binary.

**Check**:
```bash
ls bin/session-viewer*
# Should show platform-specific binary
```

**Fix**:
```bash
cd go-backend
./build.sh     # macOS/Linux
# or
build.bat      # Windows
```

**2. Claude CLI not installed**

Analysis uses the Claude CLI.

**Check**:
```bash
claude --version
# Should show version number
```

**Fix**: Install Claude CLI from https://claude.ai/cli

**3. Claude CLI not authenticated**

**Check**:
```bash
claude auth status
```

**Fix**:
```bash
claude auth login
```

**4. Session too large**

Sessions with >100,000 tokens may time out.

**Symptom**: Analysis stuck at "Analyzing..."

**Fix**: Increase timeout in settings or break up session.

---

## Platform-Specific Issues

### macOS Issues

#### "App is damaged and can't be opened"

**Cause**: macOS Gatekeeper blocks unsigned apps.

**Fix**:
```bash
xattr -cr /Applications/Universal\ Session\ Viewer.app
```

Then right-click > Open (not double-click).

#### "App can't be opened because Apple cannot check it"

**Fix**: Right-click the app, select "Open", click "Open" in dialog.

#### App crashes on Apple Silicon

**Check**: Ensure you downloaded the ARM64 build (not x64).

**Fix**: Download `Universal-Session-Viewer-mac-arm64.dmg` from Releases.

---

### Windows Issues

#### "Windows protected your PC" (SmartScreen)

**Cause**: App is not code-signed with EV certificate.

**Fix**: Click "More info" → "Run anyway". The app is safe, just not commercially signed.

#### Sessions not found on Windows

**Check path**:
```powershell
dir %USERPROFILE%\.claude\projects\
```

**Fix**: Ensure Claude Code uses default path, or configure custom path in Settings.

#### App won't start (blank window)

**Diagnostic**:
```powershell
# Check logs
type "%APPDATA%\Universal Session Viewer\logs\main.log"
```

**Common fix**: Install Visual C++ Redistributable:
- Download from Microsoft: https://aka.ms/vs/17/release/vc_redist.x64.exe

---

### Linux Issues

#### AppImage won't start

**Cause**: FUSE not installed.

**Fix**:
```bash
# Ubuntu/Debian
sudo apt-get install fuse libfuse2

# Fedora
sudo dnf install fuse

# Arch
sudo pacman -S fuse2
```

#### Sandbox errors

**Symptom**: "FATAL:setuid_sandbox_helper.cc" error

**Fix**:
```bash
./Universal-Session-Viewer.AppImage --no-sandbox
```

**Warning**: Running without sandbox reduces security. Only use temporarily.

#### Database permissions error

**Check**:
```bash
ls -la ~/.config/Universal\ Session\ Viewer/
```

**Fix**:
```bash
chmod -R 755 ~/.config/Universal\ Session\ Viewer/
```

---

## Debug Mode

For advanced troubleshooting, enable debug mode:

### Enable Debug Logging

**macOS/Linux**:
```bash
export DEBUG=universal-session-viewer:*
npm run electron:dev
```

**Windows**:
```powershell
$env:DEBUG="universal-session-viewer:*"
npm run electron:dev
```

Debug logs will show in console and log file.

### Developer Tools

In the app:
- **macOS**: Cmd + Option + I
- **Windows/Linux**: Ctrl + Shift + I

Opens Chrome DevTools for debugging renderer process.

### Verbose Logging

Settings > Advanced > Enable Verbose Logging (checkbox)

Restart app to see detailed logs in log files.

---

## Common Error Messages

### "Database is locked"

**Meaning**: Another process has exclusive access to database.

**Fix**: Quit all instances of the app, reopen.

### "ENOENT: no such file or directory"

**Meaning**: Session file was deleted or moved.

**Fix**: Rebuild index (Settings > Advanced > Rebuild Index).

### "EPIPE error"

**Meaning**: Go backend crashed or was killed.

**Fix**: Check Go backend logs, ensure Claude CLI is installed.

### "Failed to parse JSONL"

**Meaning**: Session file has invalid JSON.

**Fix**: Validate file manually or re-create session in Claude Code.

---

## Getting Help

If you've tried the steps above and still have issues:

### Before Filing an Issue

Gather this information:

1. **Environment**:
   - OS version (e.g., macOS 13.2, Windows 11, Ubuntu 22.04)
   - App version (Help > About)
   - Node.js version: `node --version` (if building from source)

2. **Logs**:
   - Paste relevant log excerpts (last 50 lines)
   - Location: See [Quick Diagnostics](#quick-diagnostics)

3. **Steps to Reproduce**:
   - What did you do?
   - What happened?
   - What did you expect?

### File an Issue

[Open an issue on GitHub](https://github.com/tadschnitzer/universal-session-viewer/issues/new)

Include:
- Clear title (e.g., "Sessions not loading on macOS 13")
- Environment information
- Steps to reproduce
- Expected vs. actual behavior
- Logs or screenshots

### Community Support

- **GitHub Discussions**: Ask questions, share tips
- **Issues**: Report bugs and feature requests

---

## Preventive Measures

Avoid common issues by following these best practices:

1. **Keep app updated**: Check for releases monthly
2. **Don't manually edit session files**: Use Claude Code only
3. **Don't run multiple instances**: Causes database locks
4. **Grant necessary permissions**: File access, notifications (macOS)
5. **Backup your sessions**: `~/.claude/projects/` directory

---

## Diagnostic Checklist

Use this checklist when troubleshooting:

- [ ] App is latest version
- [ ] Claude Code is installed
- [ ] Sessions exist in `~/.claude/projects/`
- [ ] Permissions are correct (readable directories)
- [ ] No other app instances running
- [ ] Logs checked for errors
- [ ] Database not corrupted (can rebuild if needed)
- [ ] System meets requirements (Node.js 18+, etc.)

If all checked and issue persists, [file an issue](#getting-help).

---

**Last Updated**: 2025-12-15
**For Version**: 2.0.0+

**Didn't find your issue?** [Search existing issues](https://github.com/tadschnitzer/universal-session-viewer/issues) or [ask on Discussions](https://github.com/tadschnitzer/universal-session-viewer/discussions).
