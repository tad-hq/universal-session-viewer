#!/bin/bash
# Bump version and create release tag
set -e

VERSION_TYPE="${1:-patch}"  # patch, minor, or major

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

echo "Bumping $VERSION_TYPE version..."

# Get current version
CURRENT=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT"

# Bump version using npm
npm version "$VERSION_TYPE" --no-git-tag-version

# Get new version
NEW=$(node -p "require('./package.json').version")
echo "New version: $NEW"

# Create git commit and tag
git add package.json package-lock.json
git commit -m "chore: bump version to $NEW"
git tag "v$NEW"

echo ""
echo "Version bumped to $NEW"
echo "To release, run:"
echo "  git push origin main"
echo "  git push origin v$NEW"
