# Application Icon Setup

## Quick Start

1. Place your 1024x1024 PNG icon at `build/icon_1024.png`
2. Run the generation script:
   ```bash
   ./scripts/generate-icons.sh
   ```
3. Verify with tests:
   ```bash
   npm test -- test/build/app-icons.test.ts
   ```

## Required Icon Files

| File | Platform | Format | Purpose |
|------|----------|--------|---------|
| `icon.icns` | macOS | Apple Icon Image | App bundle icon, Dock, Finder |
| `icon.ico` | Windows | Windows Icon | Taskbar, Start Menu, Explorer |
| `icon.png` | Linux | PNG (512x512) | Desktop environments |
| `icon_1024.png` | Source | PNG (1024x1024) | Master source for generation |

### File Size Requirements

- `icon.icns`: >100KB (contains all macOS sizes: 16-1024px)
- `icon.ico`: >50KB (contains sizes: 16, 24, 32, 48, 64, 128, 256px)
- `icon.png`: 512x512 pixels minimum
- `icon_1024.png`: Exactly 1024x1024 pixels

## Creating the Source Icon

### Design Requirements

1. **Size**: 1024x1024 pixels
2. **Format**: PNG with transparency (alpha channel)
3. **Color Space**: sRGB
4. **Bit Depth**: 8-bit or 16-bit per channel

### Design Recommendations for Universal Session Viewer

**Visual Metaphor Options:**
- Document/transcript with conversation bubbles
- Speech bubbles stacked or overlapping
- Terminal/code window with chat elements
- Magnifying glass over transcript

**Color Palette:**
- Primary: `#6366f1` (Indigo 500)
- Secondary: `#8b5cf6` (Violet 500)
- Background gradient: Indigo to Violet
- Accent: `#f9fafb` (Gray 50) for icons/text

**Style Guidelines:**
- Flat design with subtle gradient backgrounds
- Recognizable at 16x16 pixels (keep it simple)
- Front-facing perspective (macOS standard)
- Light source from top-left
- Subtle shadow for depth

**macOS Considerations:**
- macOS applies a rounded rectangle mask automatically
- Design within a safe area (80% of canvas)
- Avoid full-bleed designs at the edges

## Generating Platform Icons

### Automated Method (Recommended)

```bash
# From project root
./scripts/generate-icons.sh

# Or with custom source
./scripts/generate-icons.sh path/to/my-icon.png
```

**Requirements:**
- macOS (uses `iconutil` and `sips`)
- ImageMagick for Windows .ico (optional)
  ```bash
  brew install imagemagick
  ```

### Manual Method: macOS .icns

```bash
cd build

# Create iconset directory with all required sizes
mkdir -p icon.iconset
sips -z 16 16 icon_1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon_1024.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon_1024.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon_1024.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon_1024.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon_1024.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon_1024.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon_1024.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon_1024.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon_1024.png --out icon.iconset/icon_512x512@2x.png

# Convert to .icns
iconutil -c icns icon.iconset -o icon.icns

# Clean up
rm -rf icon.iconset
```

### Manual Method: Windows .ico

**Option A: ImageMagick**
```bash
convert icon_1024.png \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 24x24 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 icon.ico
```

**Option B: Online Converters**
- https://icoconvert.com/
- https://cloudconvert.com/png-to-ico
- https://convertio.co/png-ico/

### Manual Method: Linux .png

```bash
sips -z 512 512 icon_1024.png --out icon.png
```

## Verification

### Run Tests

```bash
npm test -- test/build/app-icons.test.ts
```

### Check File Properties

```bash
# Verify files exist and check sizes
ls -la build/icon.*

# Check macOS icon
file build/icon.icns
# Expected: build/icon.icns: Mac OS X icon, ... bytes, "icXX" type

# Check Windows icon
file build/icon.ico
# Expected: build/icon.ico: MS Windows icon resource - X icons

# Check Linux icon dimensions
sips -g pixelWidth -g pixelHeight build/icon.png
# Expected: 512 x 512
```

### Test in Build

```bash
# Build unsigned macOS app
npm run build:mac:unsigned

# Open DMG and verify icon
open release/*.dmg
```

## electron-builder.json Configuration

The config already references the correct paths:

```json
{
  "directories": {
    "buildResources": "build"
  },
  "mac": {
    "icon": "build/icon.icns"
  },
  "win": {
    "icon": "build/icon.ico"
  }
}
```

Linux uses `icon.png` from the `buildResources` directory automatically.

## Troubleshooting

### "Icon file not found" during build

Ensure all icon files exist in `build/`:
```bash
ls build/icon.icns build/icon.ico build/icon.png
```

### macOS icon shows generic document

1. Delete derived data: `rm -rf ~/Library/Caches/com.apple.iconservices.store`
2. Restart Finder: `killall Finder`
3. Rebuild the app

### Windows icon not appearing

Ensure `icon.ico` contains at least these sizes:
- 16x16, 32x32, 48x48, 256x256

### Icon looks pixelated

Your source PNG might be too small. Always start with 1024x1024.

## File Checklist

Before building for release:

- [ ] `icon_1024.png` - Source icon (1024x1024, PNG with transparency)
- [ ] `icon.icns` - macOS icon (>100KB, valid ICNS format)
- [ ] `icon.ico` - Windows icon (>50KB, contains 7 sizes)
- [ ] `icon.png` - Linux icon (512x512, valid PNG)
- [ ] Tests pass: `npm test -- test/build/app-icons.test.ts`
- [ ] macOS build shows icon correctly
- [ ] (Optional) Windows build shows icon correctly
- [ ] (Optional) Linux build shows icon correctly

## Resources

- [Apple Human Interface Guidelines - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Windows App Icon Guidelines](https://docs.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-design)
- [Electron Builder Icons](https://www.electron.build/icons)
