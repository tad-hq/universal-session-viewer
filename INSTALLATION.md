# Installation Guide

Complete installation instructions for Universal Session Viewer on all supported platforms.

**Jump to: [macOS](#macos-installation) | [Windows](#windows-installation) | [Linux](#linux-installation) | [Build from Source](#build-from-source) | [Troubleshooting](#troubleshooting)**

---

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Node.js** | 18.0+ | 20.0+ |
| **npm** | 9.0+ | 10.0+ |
| **RAM** | 4 GB | 8 GB |
| **Disk Space** | 500 MB | 1 GB |
| **OS** | See below | See below |

### Supported Operating Systems

- **macOS**: 10.15 (Catalina) or later, Intel or Apple Silicon
- **Windows**: Windows 10 (1903) or later, 64-bit
- **Linux**: Ubuntu 20.04+, Fedora 33+, or equivalent with glibc 2.31+

### Prerequisites

- **Claude Code** must be installed with sessions in `~/.claude/projects/`
- **Git** for cloning the repository (only needed for building from source)
- **Go 1.21+** (optional, only needed for building the LLM analysis backend from source)

---

## macOS Installation

### Option 1: Download Pre-built App (Recommended)

1. **Download the latest release**
   - Go to [Releases](https://github.com/tadschnitzer/universal-session-viewer/releases)
   - Download `Universal-Session-Viewer-2.0.0-universal.dmg`

2. **Install the app**
   - Open the downloaded DMG file
   - Drag "Universal Session Viewer" to your Applications folder

3. **First launch**
   - Open from Applications (you may need to right-click > Open the first time)
   - The app will request permission to access `~/.claude/projects/`

4. **Verify installation**
   - You should see your Claude Code sessions listed in the sidebar
   - Try searching for a recent session

### Option 2: Install via Homebrew (Coming Soon)

```bash
# Not yet available - check releases for updates
brew install --cask universal-session-viewer
```

### Option 3: Build from Source

See [Build from Source](#build-from-source) section below.

### macOS Troubleshooting

**"App is damaged and can't be opened"**

This happens with unsigned builds. To fix:
```bash
xattr -cr /Applications/Universal\ Session\ Viewer.app
```

**"App can't be opened because Apple cannot check it for malicious software"**

Right-click the app and select "Open" instead of double-clicking. You will see an option to open the app despite Gatekeeper warnings.

**App opens but shows blank window**

Try resetting the app preferences:
```bash
rm -rf ~/Library/Application\ Support/Universal\ Session\ Viewer
```
Then relaunch the app.

---

## Windows Installation

### Option 1: Download Pre-built Installer (Recommended)

1. **Download the latest release**
   - Go to [Releases](https://github.com/tadschnitzer/universal-session-viewer/releases)
   - Download `Universal-Session-Viewer-Setup-2.0.0.exe`

2. **Run the installer**
   - Double-click the downloaded file
   - Follow the installation wizard
   - Choose installation directory (default: `C:\Program Files\Universal Session Viewer`)

3. **First launch**
   - Find "Universal Session Viewer" in your Start menu
   - The app will scan for Claude Code sessions

4. **Verify installation**
   - Sessions should appear in the sidebar
   - Test search functionality

### Option 2: Portable Version

1. Download `Universal-Session-Viewer-2.0.0-win.zip`
2. Extract to any folder
3. Run `Universal Session Viewer.exe` directly

### Option 3: Build from Source

See [Build from Source](#build-from-source) section below.

### Windows Troubleshooting

**"Windows protected your PC" (SmartScreen)**

Click "More info" then "Run anyway" - the app is safe, just not code-signed with an EV certificate.

**Sessions not found**

Ensure Claude Code stores sessions in:
- `C:\Users\YOUR_USERNAME\.claude\projects\` (default)
- Or `%USERPROFILE%\.claude\projects\`

**App won't start**

Check that you have Visual C++ Redistributable installed:
- Download from [Microsoft](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)

---

## Linux Installation

### Option 1: AppImage (Recommended)

1. **Download the AppImage**
   - Go to [Releases](https://github.com/tadschnitzer/universal-session-viewer/releases)
   - Download `Universal-Session-Viewer-2.0.0.AppImage`

2. **Make it executable**
   ```bash
   chmod +x Universal-Session-Viewer-2.0.0.AppImage
   ```

3. **Run the app**
   ```bash
   ./Universal-Session-Viewer-2.0.0.AppImage
   ```

4. **Optional: Integrate with desktop**
   ```bash
   # Using AppImageLauncher (recommended)
   # Or manually move to /opt and create a .desktop file:
   sudo mv Universal-Session-Viewer-2.0.0.AppImage /opt/
   ```

### Option 2: Debian/Ubuntu (.deb)

```bash
# Download the .deb package from Releases
wget https://github.com/tadschnitzer/universal-session-viewer/releases/download/v2.0.0/universal-session-viewer_2.0.0_amd64.deb

# Install the package
sudo dpkg -i universal-session-viewer_2.0.0_amd64.deb

# If dependencies are missing:
sudo apt-get install -f
```

### Option 3: Build from Source

See [Build from Source](#build-from-source) section below.

### Linux Troubleshooting

**AppImage won't start**

Install FUSE if not present:
```bash
# Ubuntu/Debian
sudo apt-get install fuse libfuse2

# Fedora
sudo dnf install fuse
```

**Sandbox errors**

If running in a container or restricted environment:
```bash
./Universal-Session-Viewer-2.0.0.AppImage --no-sandbox
```

**GPU rendering issues**

Try disabling GPU acceleration:
```bash
./Universal-Session-Viewer-2.0.0.AppImage --disable-gpu
```

---

## Build from Source

For developers or users who need to build from source code.

### Prerequisites

```bash
# Verify Node.js version (must be 18.0.0 or higher)
node --version

# Verify npm version (must be 9.0.0 or higher)
npm --version

# Optional: Verify Go for analysis features (must be 1.21 or higher)
go version
```

### Step 1: Clone the Repository

```bash
git clone https://github.com/tadschnitzer/universal-session-viewer.git
cd universal-session-viewer
```

### Step 2: Install Dependencies

```bash
npm install
```

This will automatically rebuild native modules (like `better-sqlite3`) for Electron.

### Step 3: Build Go Backend (Optional)

The Go backend provides LLM-powered session analysis. Skip if you don't need this feature.

**macOS/Linux:**
```bash
cd go-backend
./build.sh
cd ..
```

**Windows:**
```powershell
cd go-backend
go build -o ..\bin\session-viewer-windows-amd64.exe .\cmd\session-viewer
cd ..
```

### Step 4: Run in Development Mode

```bash
npm run electron:dev
```

The app will open with hot-reload enabled for development.

### Step 5: Build Production App

```bash
# Build frontend assets
npm run build

# Package for your current platform
npm run build:mac         # macOS (requires macOS, includes code signing)
npm run build:mac:unsigned # macOS without code signing (for local testing)
npm run build:win          # Windows
npm run build:linux        # Linux

# Or build for all platforms at once
npm run build:all
```

Built applications are output to the `release/` directory.

### Build Troubleshooting

**"Cannot find module 'better-sqlite3'"**

Native modules need rebuilding:
```bash
npm run rebuild
```

**Go build fails**

Ensure Go is installed and in your PATH:
```bash
# Check Go installation
which go  # macOS/Linux
where go  # Windows

# If missing, install from https://go.dev/dl/
```

**Electron app shows blank window**

Vite dev server may not be running. Use the combined command:
```bash
npm run electron:dev
```

Or start both manually in separate terminals:
```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Wait for server, then start Electron
npm run electron
```

**TypeScript errors during build**

Run type checking to see detailed errors:
```bash
npm run typecheck
```

---

## Troubleshooting

### Common Issues

#### Sessions Not Loading

1. **Check Claude Code installation**
   ```bash
   ls ~/.claude/projects/
   # Should show project directories with JSONL files
   ```

2. **Check file permissions**
   ```bash
   # The app needs read access to your Claude sessions
   chmod -R 755 ~/.claude/projects/
   ```

3. **Restart the app**
   - Close completely (check system tray on Windows/Linux)
   - Reopen and wait for initial scan

#### Search Not Working

1. **Wait for indexing**
   - First launch indexes all sessions (can take 1-2 minutes for large libraries)
   - Look for "Indexing..." indicator in status bar

2. **Rebuild search index**
   - Go to Settings > Advanced > Rebuild Index

#### App Crashes on Startup

1. **Check logs**
   - macOS: `~/Library/Logs/Universal Session Viewer/main.log`
   - Windows: `%APPDATA%\Universal Session Viewer\logs\main.log`
   - Linux: `~/.config/Universal Session Viewer/logs/main.log`

2. **Reset app data**
   - Delete the app's data directory (see [Uninstalling](#uninstalling) section)
   - Restart the app

#### Analysis Features Not Working

1. **Verify Go backend is built**
   ```bash
   ls bin/session-viewer*
   # Should show platform-specific binary
   ```

2. **Check Claude CLI access**
   - Analysis requires Claude CLI to be installed and authenticated
   - Run `claude --version` to verify Claude CLI is available

### Getting Help

If you're still having issues:

1. **Search existing issues**: [GitHub Issues](https://github.com/tadschnitzer/universal-session-viewer/issues)
2. **Open a new issue**: Include:
   - Operating system and version
   - Node.js version (`node --version`)
   - Error messages or logs
   - Steps to reproduce the issue

---

## Uninstalling

### macOS

**Remove the app:**
1. Open Finder > Applications
2. Drag "Universal Session Viewer" to Trash
3. Empty Trash

**Remove app data (optional):**
```bash
rm -rf ~/Library/Application\ Support/Universal\ Session\ Viewer
rm -rf ~/Library/Caches/Universal\ Session\ Viewer
rm -rf ~/Library/Logs/Universal\ Session\ Viewer
rm -rf ~/.universal-session-viewer
```

### Windows

**Standard uninstall:**
1. Open Settings > Apps > Installed apps
2. Find "Universal Session Viewer"
3. Click Uninstall

**Remove app data (optional):**
```powershell
Remove-Item -Recurse "$env:APPDATA\Universal Session Viewer"
Remove-Item -Recurse "$env:USERPROFILE\.universal-session-viewer"
```

### Linux

**AppImage:**
```bash
rm ~/path/to/Universal-Session-Viewer.AppImage
rm -rf ~/.config/Universal\ Session\ Viewer
rm -rf ~/.universal-session-viewer
```

**DEB package:**
```bash
sudo apt remove universal-session-viewer
rm -rf ~/.config/Universal\ Session\ Viewer
rm -rf ~/.universal-session-viewer
```

---

## Verifying Installation

After installing, verify everything works:

1. **App launches** - Window opens without errors
2. **Sessions discovered** - Your Claude Code sessions appear in sidebar
3. **Search works** - Type a query in the search box, see results
4. **Session details load** - Click a session, view messages
5. **Analysis works** (optional) - Click "Analyze" on a session

If all checks pass, you're ready to use Universal Session Viewer!

---

## Next Steps

- **[README.md](README.md)** - Project overview and quick start
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute to the project

---

**Need help?** [Open an issue](https://github.com/tadschnitzer/universal-session-viewer/issues) or check [Troubleshooting](#troubleshooting).
