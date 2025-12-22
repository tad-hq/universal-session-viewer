# Icon Design Specification

## Universal Session Viewer App Icon

### Overview

The app icon represents a session viewer for Claude Code conversation transcripts. It should convey:
- Conversation/chat context
- Document/transcript viewing
- Professional developer tooling
- Connection to Claude (via color palette)

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Indigo 500 | `#6366f1` | Primary background gradient start |
| Violet 500 | `#8b5cf6` | Primary background gradient end |
| White | `#ffffff` | Document background, icon elements |
| Gray 50 | `#f9fafb` | Light accents |
| Gray 200 | `#e2e8f0` | Assistant message bubbles |
| Gray 400 | `#94a3b8` | Subtle elements |

### Design Concept Options

#### Option 1: Document with Chat Bubbles (Recommended)
A document/transcript icon with embedded chat message representations.
- Central document with rounded corners
- Header bar with traffic light dots (macOS style)
- Alternating chat message blocks (user in indigo, assistant in gray)
- See `icon-template.svg` for implementation

#### Option 2: Overlapping Speech Bubbles
Two or three speech bubbles overlapping.
- Large bubble behind (assistant)
- Smaller bubble in front (user)
- Gradient background

#### Option 3: Magnifying Glass + Transcript
A magnifying glass over stylized text lines.
- Represents "viewing" sessions
- Text lines in document format
- Magnifying glass with gradient handle

### Technical Requirements

| Requirement | Value |
|-------------|-------|
| Canvas Size | 1024 x 1024 pixels |
| Safe Area | 80% (820 x 820 px centered) |
| Format | PNG with transparency |
| Color Space | sRGB |
| Bit Depth | 8-bit or 16-bit |
| DPI | 72 (for screens) |

### Platform-Specific Notes

#### macOS
- Rounded rectangle mask applied automatically by system
- Design should work within circular and squircle shapes
- Test at 16x16, 32x32, 128x128, 512x512 sizes
- Avoid text or fine details that disappear at small sizes

#### Windows
- Square format, no automatic masking
- Consider subtle rounded corners in design itself
- Test at 16x16, 32x32, 48x48, 256x256

#### Linux
- Various desktop environments handle differently
- Square format works best
- 512x512 primary size

### Design Guidelines

1. **Simplicity**: The icon must be recognizable at 16x16 pixels
2. **Contrast**: High contrast between foreground elements and background
3. **Depth**: Subtle shadows add dimension without overwhelming
4. **Balance**: Visual weight centered in the canvas
5. **Brand Alignment**: Colors align with Claude/Anthropic brand (indigo/violet)

### Export Process

1. Design in vector format (Figma, Illustrator, Sketch, or SVG)
2. Export as 1024x1024 PNG with transparency
3. Save to `build/icon_1024.png`
4. Run `./scripts/generate-icons.sh`
5. Verify with `npm test -- test/build/app-icons.test.ts`

### Reference Images

For inspiration:
- VSCode icon (document with brackets)
- Discord icon (speech bubble)
- Slack icon (hashtag in rounded square)
- macOS Notes icon (yellow notepad)
- Apple Messages icon (speech bubble with gradient)

### Files in This Directory

- `icon-template.svg` - Starting point SVG with basic design
- `DESIGN_SPEC.md` - This specification document

### Final Deliverables

After design is complete:
- [ ] `../icon_1024.png` - Master source (1024x1024)
- [ ] `../icon.icns` - macOS icon (generated)
- [ ] `../icon.ico` - Windows icon (generated)
- [ ] `../icon.png` - Linux icon (generated)
