#!/bin/bash
set -e

# Build for all platforms
OUTPUT_DIR="../bin"
CMD_PATH="./cmd/session-viewer"

# Skip if binaries already exist (e.g., downloaded in CI)
if [ -f "$OUTPUT_DIR/session-viewer-darwin-arm64" ] && [ -f "$OUTPUT_DIR/session-viewer-linux-amd64" ]; then
    echo "Go binaries already exist, skipping build"
    ls -lh "$OUTPUT_DIR/"
    exit 0
fi

# Check if Go is available
if ! command -v go &> /dev/null; then
    echo "Go not found, skipping Go build (binaries should be provided separately)"
    exit 0
fi

echo "Building session-viewer for multiple platforms..."

# macOS Apple Silicon
echo "Building for darwin/arm64..."
GOOS=darwin GOARCH=arm64 go build -o "$OUTPUT_DIR/session-viewer-darwin-arm64" $CMD_PATH

# macOS Intel
echo "Building for darwin/amd64..."
GOOS=darwin GOARCH=amd64 go build -o "$OUTPUT_DIR/session-viewer-darwin-amd64" $CMD_PATH

# Linux
echo "Building for linux/amd64..."
GOOS=linux GOARCH=amd64 go build -o "$OUTPUT_DIR/session-viewer-linux-amd64" $CMD_PATH

# Windows
echo "Building for windows/amd64..."
GOOS=windows GOARCH=amd64 go build -o "$OUTPUT_DIR/session-viewer-windows-amd64.exe" $CMD_PATH

# Development binary (current platform)
echo "Building for current platform..."
go build -o "$OUTPUT_DIR/session-viewer" $CMD_PATH

echo "Build complete! Binaries in $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR/"
