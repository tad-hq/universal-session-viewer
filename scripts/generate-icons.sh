#!/bin/bash
# =============================================================================
# Icon Generation Script for Universal Session Viewer
# =============================================================================
# Generates all platform icons from a source 1024x1024 PNG file.
#
# Usage:
#   ./scripts/generate-icons.sh [source-1024.png]
#
# Requirements:
#   - macOS (for iconutil and sips)
#   - ImageMagick (optional, for Windows .ico generation)
#     Install with: brew install imagemagick
#
# Output:
#   - build/icon.icns  (macOS)
#   - build/icon.ico   (Windows, requires ImageMagick)
#   - build/icon.png   (Linux, 512x512)
# =============================================================================

set -e

# Configuration
SOURCE="${1:-build/icon_1024.png}"
BUILD_DIR="build"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "==================================================================="
echo "  Universal Session Viewer - Icon Generator"
echo "==================================================================="
echo ""

# Verify source file exists
if [ ! -f "$SOURCE" ]; then
    echo -e "${RED}Error: Source file '$SOURCE' not found${NC}"
    echo ""
    echo "Usage: ./scripts/generate-icons.sh [source-1024.png]"
    echo ""
    echo "Please provide a 1024x1024 PNG file as the source."
    echo "Place it at: ${PROJECT_ROOT}/build/icon_1024.png"
    echo ""
    echo "Design recommendations:"
    echo "  - Size: 1024x1024 pixels"
    echo "  - Format: PNG with transparency"
    echo "  - Colors: #6366f1 (Indigo) to #8b5cf6 (Violet) gradient"
    echo "  - Style: Flat design with subtle shadows"
    echo "  - Content: Document/transcript icon or chat bubbles"
    exit 1
fi

# Verify it's a PNG
if ! file "$SOURCE" | grep -q "PNG image"; then
    echo -e "${RED}Error: Source file is not a valid PNG${NC}"
    exit 1
fi

# Verify dimensions
DIMENSIONS=$(sips -g pixelWidth -g pixelHeight "$SOURCE" 2>/dev/null | grep "pixel" | awk '{print $2}')
WIDTH=$(echo "$DIMENSIONS" | head -n1)
HEIGHT=$(echo "$DIMENSIONS" | tail -n1)

if [ "$WIDTH" != "1024" ] || [ "$HEIGHT" != "1024" ]; then
    echo -e "${YELLOW}Warning: Source image is ${WIDTH}x${HEIGHT}, not 1024x1024${NC}"
    echo "For best results, use a 1024x1024 source image."
    echo ""
fi

echo "Source: $SOURCE"
echo "Output: $BUILD_DIR/"
echo ""

# =============================================================================
# Generate macOS .icns
# =============================================================================
echo -e "${GREEN}[1/3] Creating macOS icon (icon.icns)...${NC}"

# Create temporary iconset directory
ICONSET_DIR="$BUILD_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate all required sizes
echo "  - Generating icon sizes..."
sips -z 16 16 "$SOURCE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null 2>&1
sips -z 64 64 "$SOURCE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null 2>&1
sips -z 128 128 "$SOURCE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null 2>&1
sips -z 1024 1024 "$SOURCE" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null 2>&1

# Convert to .icns
echo "  - Converting to .icns format..."
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"

# Clean up iconset directory
rm -rf "$ICONSET_DIR"

# Verify
if [ -f "$BUILD_DIR/icon.icns" ]; then
    SIZE=$(ls -lh "$BUILD_DIR/icon.icns" | awk '{print $5}')
    echo -e "  ${GREEN}Created: icon.icns ($SIZE)${NC}"
else
    echo -e "  ${RED}Failed to create icon.icns${NC}"
    exit 1
fi

# =============================================================================
# Generate Linux .png (512x512)
# =============================================================================
echo ""
echo -e "${GREEN}[2/3] Creating Linux icon (icon.png)...${NC}"

sips -z 512 512 "$SOURCE" --out "$BUILD_DIR/icon.png" >/dev/null 2>&1

if [ -f "$BUILD_DIR/icon.png" ]; then
    SIZE=$(ls -lh "$BUILD_DIR/icon.png" | awk '{print $5}')
    echo -e "  ${GREEN}Created: icon.png ($SIZE)${NC}"
else
    echo -e "  ${RED}Failed to create icon.png${NC}"
    exit 1
fi

# =============================================================================
# Generate Windows .ico
# =============================================================================
echo ""
echo -e "${GREEN}[3/3] Creating Windows icon (icon.ico)...${NC}"

if command -v convert &> /dev/null; then
    # ImageMagick is available
    convert "$SOURCE" \
        \( -clone 0 -resize 16x16 \) \
        \( -clone 0 -resize 24x24 \) \
        \( -clone 0 -resize 32x32 \) \
        \( -clone 0 -resize 48x48 \) \
        \( -clone 0 -resize 64x64 \) \
        \( -clone 0 -resize 128x128 \) \
        \( -clone 0 -resize 256x256 \) \
        -delete 0 "$BUILD_DIR/icon.ico"

    if [ -f "$BUILD_DIR/icon.ico" ]; then
        SIZE=$(ls -lh "$BUILD_DIR/icon.ico" | awk '{print $5}')
        echo -e "  ${GREEN}Created: icon.ico ($SIZE)${NC}"
    else
        echo -e "  ${RED}Failed to create icon.ico${NC}"
    fi
else
    echo -e "  ${YELLOW}Warning: ImageMagick not found. Windows .ico not created.${NC}"
    echo "  Install with: brew install imagemagick"
    echo "  Then run this script again."
    echo ""
    echo "  Alternative: Use an online converter:"
    echo "    - https://icoconvert.com/"
    echo "    - https://cloudconvert.com/png-to-ico"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "==================================================================="
echo "  Generation Complete"
echo "==================================================================="
echo ""
echo "Generated files:"
ls -la "$BUILD_DIR"/icon.* 2>/dev/null || echo "  No icon files found"
echo ""

# Check what's missing
MISSING=""
[ ! -f "$BUILD_DIR/icon.icns" ] && MISSING="${MISSING}icon.icns "
[ ! -f "$BUILD_DIR/icon.ico" ] && MISSING="${MISSING}icon.ico "
[ ! -f "$BUILD_DIR/icon.png" ] && MISSING="${MISSING}icon.png "

if [ -n "$MISSING" ]; then
    echo -e "${YELLOW}Missing files: ${MISSING}${NC}"
    echo ""
fi

echo "Next steps:"
echo "  1. Run tests: npm test -- test/build/app-icons.test.ts"
echo "  2. Build app: npm run build:mac:unsigned"
echo "  3. Verify icon appears correctly in built app"
echo ""
