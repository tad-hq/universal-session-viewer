# Contributing to Universal Session Viewer

Thank you for your interest in contributing to Universal Session Viewer! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [V1 Pattern Preservation](#v1-pattern-preservation)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful, inclusive, and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in the Issues section
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the behavior
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS version, Node version, etc.)

### Suggesting Features

1. Check existing issues and discussions for similar suggestions
2. Create a new issue with the "enhancement" label
3. Describe the feature and its use case
4. Explain how it fits with the existing functionality

### Contributing Code

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following our guidelines
4. Submit a pull request

## Development Setup

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher
- **macOS**: Primary development platform
- **Git**: For version control

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/universal-session-viewer.git
# Or clone the main repo:
# git clone https://github.com/tad-hq/universal-session-viewer.git
cd universal-session-viewer

# Install dependencies
npm install

# Rebuild native modules for Electron
npm run electron:rebuild
```

### Running Locally

```bash
# Development mode with hot reload
npm run electron:dev

# Or run components separately:
npm run dev          # Vite dev server (http://localhost:5173)
npm run electron     # Electron app (requires Vite running)
```

### Building

```bash
# Full build
npm run build

# Package for macOS
npm run build:mac
```

## Code Style Guidelines

### TypeScript

We use strict TypeScript configuration. All code must:

- Have `strict: true` compliance
- Avoid `any` types - use proper typing or `unknown` with type guards
- Include explicit return types on all functions
- Use interfaces for object types (not inline types)

```typescript
// Good
interface SessionData {
  id: string;
  name: string;
}

function getSession(id: string): SessionData | null {
  // implementation
}

// Bad
function getSession(id: any): any {
  // implementation
}
```

### React

- Use functional components exclusively (no class components)
- Use hooks for state and lifecycle management
- Prefer custom hooks for reusable logic
- Use `useCallback` and `useMemo` where performance matters
- Keep components focused and composable

```typescript
// Good - focused component with hook
function SessionList() {
  const { sessions, isLoading } = useSessions();

  if (isLoading) return <Skeleton />;
  return <ul>{sessions.map(s => <SessionItem key={s.id} session={s} />)}</ul>;
}

// Bad - mixing concerns
function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // ... 50 lines of logic that should be in a hook
}
```

### Zustand Stores

- Keep stores focused on a single domain
- Use selectors for optimized subscriptions
- Include comprehensive inline comments referencing V1 patterns
- Follow the existing store structure

### ESLint and Prettier

The project uses ESLint and Prettier for code quality:

```bash
# Lint check
npm run lint

# Format code
npm run format
```

### File Organization

```
src/
  components/
    {domain}/           # Group by feature, not by type
      ComponentName.tsx
      index.ts          # Barrel export
  hooks/
    useHookName.ts      # Custom hooks
    index.ts            # Barrel export
  stores/
    domainStore.ts      # Zustand stores
    index.ts            # Barrel export
  types/
    domain.ts           # Type definitions
    index.ts            # Barrel export
  utils/
    utilName.ts         # Utility functions
```

## Commit Message Conventions

We follow the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI configuration changes
- `chore`: Other changes that don't modify src or test files

### Examples

```bash
feat(sessions): add keyboard navigation support

Implements vim-style navigation (j/k) for session list.
Preserves V1 patterns from index.html lines 1956-2042.

Closes #123
```

```bash
fix(search): debounce search input to prevent API spam

V1 had no debouncing, causing excessive API calls.
Added 300ms debounce as a V1 limitation fix.
```

## Pull Request Process

### Before Submitting

1. Ensure your code follows the style guidelines
2. Run linting: `npm run lint`
3. Run type checking: `npm run build`
4. Test your changes manually
5. Update documentation if needed

### PR Requirements

1. **Title**: Use conventional commit format
2. **Description**: Explain what and why, not just how
3. **V1 References**: If modifying existing patterns, reference V1 source locations
4. **Screenshots**: Include for UI changes
5. **Testing**: Describe how you tested the changes

### Review Process

1. A maintainer will review your PR
2. Address any feedback or requested changes
3. Once approved, a maintainer will merge your PR

## Testing Requirements

### Manual Testing

Currently, the project relies on manual testing. When submitting a PR:

1. Test the happy path for your feature
2. Test edge cases (empty states, errors, etc.)
3. Test on macOS (primary platform)
4. Document any platform-specific behavior

### Future Testing

We plan to add:

- Unit tests with Vitest
- Component tests with React Testing Library
- E2E tests with Playwright

## V1 Pattern Preservation

This project is a rewrite of V1 (vanilla JavaScript). Many patterns in V1 represent battle-tested solutions to edge cases. When contributing:

### Understanding V1 Patterns

1. Read `V1_EDGE_CASES.md` before making changes
2. Reference the V1 source code when modifying existing patterns
3. Preserve edge case handling unless there's a clear improvement

### Documented Patterns

Key patterns that MUST be preserved:

| Pattern                    | V1 Reference    | Purpose                     |
| -------------------------- | --------------- | --------------------------- |
| Renderer-ready handshake   | main.js:89-105  | Race condition prevention   |
| UUID filtering             | main.js:245-280 | Skip agent/temp files       |
| 300ms debounce             | main.js:523-545 | File watcher batching       |
| 500ms stabilization        | main.js:527-545 | Wait for file writes        |
| Dual ID field              | index.html:1555 | Handle `id` or `session_id` |
| Search disables pagination | index.html:1055 | Different loading modes     |

### When Changing V1 Patterns

If you need to modify a V1 pattern:

1. Document why the change is necessary
2. Reference the V1 location being changed
3. Explain what edge case the original handled
4. Describe how your change maintains that protection (or why it's no longer needed)

### Code Comments

Include V1 references in comments:

```typescript
// V1 Pattern (main.js:245-280): Session discovery
// Must validate UUID format to skip agent files
if (!isValidUUID(sessionId)) {
  continue;
}
```

## Questions?

If you have questions about contributing, feel free to:

1. Open a discussion in the repository
2. Comment on a related issue
3. Ask in your pull request

Thank you for contributing!

---

# Release Process

This section documents how to create and publish releases of Universal Session Viewer.

## Release Checklist

### Pre-Release

- [ ] All features for this release are merged to `main`
- [ ] All tests pass (`npm run typecheck && npm run lint`)
- [ ] Application runs correctly in development mode
- [ ] Local unsigned build works (`npm run build:mac:unsigned`)
- [ ] Version number is updated in `package.json`
- [ ] CHANGELOG is updated (if maintained)

### Version Bumping

Update the version in `package.json`:

```bash
# For patch releases (bug fixes)
npm version patch

# For minor releases (new features, backward compatible)
npm version minor

# For major releases (breaking changes)
npm version major

# For pre-release versions
npm version prerelease --preid=beta
```

### Creating a Release

#### Option 1: Automated (GitHub Actions)

1. Create and push a version tag:

   ```bash
   git tag v2.1.0
   git push origin v2.1.0
   ```

2. The GitHub Actions workflow will automatically:
   - Build the macOS universal binary
   - Code sign the application (if credentials are configured)
   - Notarize with Apple (if credentials are configured)
   - Create a GitHub Release with artifacts

3. Review the draft release and publish when ready

#### Option 2: Manual Release

```bash
# Build and publish to GitHub Releases
npm run release

# Or create a draft release
npm run release:draft
```

### Local Testing (Unsigned Build)

For testing without code signing:

```bash
npm run build:mac:unsigned
```

The built app will be in `release/` directory.

---

## GitHub Secrets Setup

The following secrets must be configured in your GitHub repository for automated releases:

### Required for Code Signing

| Secret             | Description                       | How to Obtain                                          |
| ------------------ | --------------------------------- | ------------------------------------------------------ |
| `CSC_LINK`         | Base64-encoded .p12 certificate   | Export from Keychain, then `base64 -i certificate.p12` |
| `CSC_KEY_PASSWORD` | Password for the .p12 certificate | Password you set when exporting                        |

### Required for Notarization

| Secret                        | Description                   | How to Obtain                                                                           |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `APPLE_ID`                    | Apple Developer account email | Your Apple ID email                                                                     |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password         | Generate at [appleid.apple.com](https://appleid.apple.com/account/manage)               |
| `APPLE_TEAM_ID`               | 10-character Team ID          | Find at [developer.apple.com/account](https://developer.apple.com/account/#/membership) |

### Required for Publishing

| Secret     | Description                  | How to Obtain                                                           |
| ---------- | ---------------------------- | ----------------------------------------------------------------------- |
| `GH_TOKEN` | GitHub Personal Access Token | Create at GitHub Settings > Developer settings > Personal access tokens |

---

## Code Signing Setup

### Creating a Developer ID Certificate

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)

2. In Xcode or Keychain Access, create a "Developer ID Application" certificate

3. Export the certificate as a .p12 file:

   ```bash
   # In Keychain Access:
   # 1. Right-click the certificate
   # 2. Export "Developer ID Application: Your Name"
   # 3. Save as certificate.p12 with a strong password
   ```

4. Encode for GitHub Secrets:
   ```bash
   base64 -i certificate.p12 | pbcopy
   # Paste as CSC_LINK secret
   ```

### Local Code Signing

For local signed builds, the certificate must be in your Keychain:

```bash
# Verify your certificate is available
security find-identity -v -p codesigning

# Build with automatic signing
npm run build:mac
```

---

## Notarization Setup

### Creating an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com/account/manage)
2. Sign in with your Apple ID
3. Under "Sign-In and Security", select "App-Specific Passwords"
4. Click "+" to generate a new password
5. Name it "Universal Session Viewer Notarization"
6. Save the generated password securely

### Finding Your Team ID

1. Go to [developer.apple.com/account](https://developer.apple.com/account/#/membership)
2. Your Team ID is displayed on the Membership page
3. It's a 10-character alphanumeric string (e.g., "ABCD1234EF")

### Testing Notarization Locally

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCD1234EF"

npm run build:mac
```

---

## Troubleshooting

### Build Failures

**"Cannot find module 'better-sqlite3'"**

```bash
npm run rebuild
```

**"Code signing failed"**

- Verify your certificate is in Keychain
- Check `security find-identity -v -p codesigning`
- Ensure certificate is not expired

**"Notarization failed"**

- Verify Apple ID and app-specific password
- Check Team ID is correct
- Ensure hardened runtime is enabled
- Review entitlements for required permissions

### Common Issues

**App shows "damaged" on first launch**

- This means code signing or notarization failed
- Right-click > Open to bypass Gatekeeper for testing
- For distribution, proper signing is required

**Auto-update not working**

- Verify `publish` configuration in `electron-builder.json`
- Check GitHub Releases has the `latest-mac.yml` file
- Ensure the app is signed (unsigned apps can't auto-update)
