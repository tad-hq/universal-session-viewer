# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

Only the latest major version receives security updates. We recommend always using the most recent release.

## Reporting a Vulnerability

We take security vulnerabilities seriously. Thank you for helping us keep Universal Session Viewer secure.

### How to Report

**Preferred Method: GitHub Security Advisories**

1. Go to the [Security Advisories](https://github.com/tadschnitzer/universal-session-viewer/security/advisories) page
2. Click "Report a vulnerability"
3. Fill out the private vulnerability report form
4. We will respond within 48 hours

**Alternative: Email**

If you cannot use GitHub, you can report vulnerabilities via email:
- Email: `tad@tad.md`

When reporting, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)
- Your preferred contact method for follow-up

### What to Expect

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial Assessment | Within 7 days |
| Status Update | Every 14 days until resolved |

### Severity-Based Fix Timeline

| Severity | Fix Timeline | Examples |
|----------|--------------|----------|
| **Critical** | 7 days | Remote code execution, data exfiltration |
| **High** | 30 days | Privilege escalation, significant data exposure |
| **Medium** | 60 days | Limited data exposure, DoS vulnerabilities |
| **Low** | 90 days | Minor information disclosure, theoretical attacks |

### Disclosure Policy

- We follow a **90-day disclosure policy**
- Vulnerabilities will be publicly disclosed 90 days after a fix is released
- We will coordinate disclosure timing with you
- We will credit you in the security advisory (unless you prefer anonymity)

### What We Ask

- **Do not** publicly disclose the vulnerability until we have addressed it
- **Do not** access or modify user data without permission
- **Do not** perform actions that could harm users or systems
- **Do** provide sufficient detail to reproduce the issue
- **Do** give us reasonable time to fix the issue before disclosure

### Safe Harbor

We support safe harbor for security researchers who:
- Act in good faith
- Avoid privacy violations and data destruction
- Report vulnerabilities promptly
- Allow reasonable time for fixes

We will not pursue legal action against researchers who follow these guidelines.

## Scope of Security Issues

### In Scope

The following types of vulnerabilities are within the scope of this security policy:

- **Remote Code Execution (RCE)**: Ability to execute arbitrary code through the application
- **Privilege Escalation**: Gaining elevated privileges beyond intended access
- **Data Exposure**: Unauthorized access to session data or user files
- **Path Traversal**: Access to files outside intended directories
- **SQL Injection**: Attacks against the SQLite database
- **Command Injection**: Arbitrary shell command execution
- **Cross-Site Scripting (XSS)**: Script injection in the renderer process
- **IPC Security Bypass**: Circumventing the preload bridge security model
- **Denial of Service**: Crashes or resource exhaustion that affect usability

### Out of Scope

The following are **not** considered security vulnerabilities for this project:

- **Local-only attacks requiring physical access**: This is a desktop application; physical access implies full compromise
- **Self-XSS**: Attacks that require the user to paste malicious code themselves
- **Social engineering**: Phishing, credential theft through deception
- **Vulnerabilities in dependencies without demonstrated exploit**: Please report with proof-of-concept
- **Issues in development/test environments only**: Must affect production builds
- **Theoretical attacks without practical demonstration**: Please include steps to reproduce
- **Rate limiting or brute force on local resources**: No network services are exposed
- **Missing security headers**: Application does not serve web content externally

### Application Context

Universal Session Viewer is a **local desktop application** that:
- Reads session data from the local filesystem (`~/.claude/projects/`)
- Stores its cache locally (`~/.universal-session-viewer/`)
- Makes **no external network requests**
- Has **no user authentication system**
- Runs entirely on the user's machine

This context is important when assessing vulnerability severity. A vulnerability that would be critical in a web application may be lower severity in this local-only context.

## Security Best Practices for Users

### Installation Verification

After downloading, verify the application:

**macOS:**
```bash
# Check code signature
codesign -dv --verbose=4 /Applications/Universal\ Session\ Viewer.app

# Verify notarization
spctl -a -t exec -vv /Applications/Universal\ Session\ Viewer.app
```

**Checksums** (provided in release notes):
```bash
# Verify SHA-256 checksum
shasum -a 256 Universal-Session-Viewer-*.dmg
```

### Data Security

- Session data is stored locally at `~/.claude/projects/`
- The application cache is at `~/.universal-session-viewer/`
- No data is transmitted over the network
- The application runs in a sandboxed Electron environment

### Recommended Practices

1. Download only from official releases on GitHub
2. Verify code signatures before installation
3. Keep the application updated to receive security fixes
4. Report any suspicious behavior through our security channels

## Security Architecture

### Electron Security Model

This application follows Electron security best practices:

- **Context Isolation**: Enabled (`contextIsolation: true`)
- **Node Integration**: Disabled (`nodeIntegration: false`)
- **Remote Module**: Disabled (not available in Electron 28+)
- **Preload Script**: Whitelist-based IPC bridge
- **Sandbox**: Renderer process is sandboxed

### Data Protection

- All SQL queries use parameterized statements (SQL injection prevention)
- Shell commands use proper escaping (command injection prevention)
- File paths are validated before access (path traversal prevention)
- User content is sanitized before rendering (XSS prevention)

### Network Security

- The application makes no external network requests
- All data remains on your local machine
- Development server binds to localhost only

## Previous Security Advisories

| Date | Advisory | Severity | Fixed In |
|------|----------|----------|----------|
| - | No advisories yet | - | - |

---

Thank you for helping keep Universal Session Viewer and its users safe!
