# First Time Contributor Guide

Welcome! We're excited you want to contribute to Universal Session Viewer. This guide will help you make your first contribution, even if you've never contributed to open source before.

## Table of Contents

- [Before You Start](#before-you-start)
- [Finding Your First Issue](#finding-your-first-issue)
- [Setting Up Your Environment](#setting-up-your-environment)
- [Making Your Changes](#making-your-changes)
- [Submitting Your Pull Request](#submitting-your-pull-request)
- [What Happens Next](#what-happens-next)
- [Getting Help](#getting-help)

## Before You Start

### Prerequisites

You'll need:
- **Git** installed ([download](https://git-scm.com/downloads))
- **Node.js 18+** installed ([download](https://nodejs.org/))
- **A GitHub account** ([sign up](https://github.com/join))
- **A code editor** (we recommend [VS Code](https://code.visualstudio.com/))

### Understanding the Project

Universal Session Viewer is a desktop application built with:
- **Electron** - Makes it a desktop app
- **React** - User interface
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Styling
- **Go** - Backend for LLM analysis

Don't worry if you're not familiar with all of these! Many contributions don't require deep knowledge of the full stack.

## Finding Your First Issue

### Good First Issues

We label beginner-friendly issues with `good first issue`:

[**View Good First Issues**](https://github.com/tadschnitzer/universal-session-viewer/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)

These issues are:
- Well-documented with clear steps
- Limited in scope
- Don't require deep codebase knowledge
- Great for learning our workflow

### Claiming an Issue

Before you start working:

1. **Check if someone's already working on it** - Look for linked PRs or comments saying "I'm working on this"
2. **Comment to claim it** - Write "I'd like to work on this!" so others know
3. **Ask questions** - If anything is unclear, ask in the issue comments

## Setting Up Your Environment

### Step 1: Fork the Repository

1. Go to [the repository](https://github.com/tadschnitzer/universal-session-viewer)
2. Click the "Fork" button in the top right
3. This creates your own copy at `github.com/YOUR-USERNAME/universal-session-viewer`

### Step 2: Clone Your Fork

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/universal-session-viewer.git

# Navigate into the directory
cd universal-session-viewer

# Add the original repo as "upstream" (for syncing later)
git remote add upstream https://github.com/tadschnitzer/universal-session-viewer.git
```

### Step 3: Install Dependencies

```bash
# Install npm packages
npm install

# Rebuild native modules for Electron
npm run rebuild
```

### Step 4: Build Go Backend

```bash
# Build the Go backend
cd go-backend
./build.sh
cd ..
```

### Step 5: Verify It Works

```bash
# Start the development server
npm run electron:dev
```

You should see the application window open. If you see errors, check the [Troubleshooting](#troubleshooting) section.

## Making Your Changes

### Step 1: Create a Branch

Always create a new branch for your changes:

```bash
# Make sure you're on main
git checkout main

# Pull latest changes
git pull upstream main

# Create a new branch
git checkout -b your-branch-name
```

**Branch naming tips:**
- `fix/typo-in-readme` - For bug fixes
- `feature/add-dark-mode` - For new features
- `docs/update-install-guide` - For documentation

### Step 2: Make Your Changes

Edit the files needed for your issue. Some tips:

- **Run the app while developing**: `npm run electron:dev`
- **Check types**: `npm run typecheck`
- **Check code style**: `npm run lint`
- **Format code**: `npm run format`

### Step 3: Test Your Changes

Before submitting:

1. **Manual testing** - Use the app, verify your change works
2. **Run linting** - `npm run lint` (must pass)
3. **Run type checking** - `npm run typecheck` (must pass)
4. **Run tests** - `npm test` (if applicable)

### Step 4: Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "fix: correct typo in README"
```

**Commit message format:**
- `fix: description` - For bug fixes
- `feat: description` - For new features
- `docs: description` - For documentation
- `style: description` - For formatting changes
- `refactor: description` - For code restructuring

See [CONTRIBUTING.md](CONTRIBUTING.md#commit-message-conventions) for full details.

### Step 5: Push to GitHub

```bash
git push origin your-branch-name
```

## Submitting Your Pull Request

### Step 1: Open the PR

1. Go to your fork on GitHub
2. You'll see a banner saying "Compare & pull request" - click it
3. Or go to "Pull requests" > "New pull request"

### Step 2: Fill Out the PR Template

We have a template that guides you. Fill in:

- **Description**: What does your PR do?
- **Related Issue**: Link to the issue (e.g., "Fixes #123")
- **Testing Done**: How did you verify it works?
- **Checklist**: Confirm you've followed the guidelines

### Step 3: Submit

Click "Create pull request"!

## What Happens Next

### Review Process

1. **Automated checks** - Our CI will run linting and type checks
2. **Maintainer review** - A maintainer will review your code
3. **Feedback** - You may receive suggestions for changes
4. **Approval** - Once approved, your PR will be merged!

### Responding to Feedback

Don't worry if you receive feedback - it's normal and helpful!

- **Questions**: Answer them in the PR comments
- **Change requests**: Make the changes, commit, and push
- **Discussions**: Engage respectfully, explain your reasoning

### After Your PR is Merged

Congratulations! You're now a contributor!

```bash
# Switch back to main
git checkout main

# Pull the latest (including your change!)
git pull upstream main

# Delete your branch
git branch -d your-branch-name
```

## Getting Help

### Stuck? Here's Where to Ask

- **Issue comments** - Ask questions on the issue you're working on
- **GitHub Discussions** - [Q&A category](https://github.com/tadschnitzer/universal-session-viewer/discussions/categories/q-a)
- **Pull Request** - Ask questions in your PR if you're stuck during implementation

### Troubleshooting

**"npm install" fails**
- Make sure you have Node.js 18+: `node --version`
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

**"npm run electron:dev" shows errors**
- Run `npm run rebuild` to rebuild native modules
- Check if another Electron app is running
- Make sure Go backend is built: `cd go-backend && ./build.sh`

**"npm run lint" fails**
- Run `npm run lint:fix` to auto-fix many issues
- Check the output for remaining manual fixes

**Merge conflicts**
- Pull latest main: `git pull upstream main`
- Resolve conflicts in your editor
- Commit the resolution

**Go build fails**
- Make sure you have Go 1.21+ installed: `go version`
- Check that you're in the `go-backend` directory
- Try `go mod tidy` to clean up dependencies

## What Makes a Good First Contribution?

Great first contributions:
- Fix typos or improve documentation
- Add tests for existing code
- Fix small UI bugs
- Improve error messages
- Add helpful code comments

Don't worry about:
- Making it perfect (we'll help in review)
- Understanding the whole codebase
- Breaking something (that's what review is for)

## Thank You!

Every contribution matters, whether it's fixing a typo or adding a major feature. We appreciate you taking the time to help improve Universal Session Viewer!

---

**Ready to contribute?** [Find a good first issue](https://github.com/tadschnitzer/universal-session-viewer/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)

**Need the detailed guide?** See [CONTRIBUTING.md](CONTRIBUTING.md)

**Have questions?** [Start a discussion](https://github.com/tadschnitzer/universal-session-viewer/discussions/new?category=q-a)
