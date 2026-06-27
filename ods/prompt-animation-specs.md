# OpenDesign Prompt: Planetwood Animation Specs Reference

## Mission
Create a comprehensive visual reference document for all 39 animation clips used in Planetwood. This document will serve as the primary reference for implementing `AnimationSystem.js` (T006) — the runtime system that builds bone hierarchies from decoded JSON and plays per-frame skeletal animations.

## Brand Tokens (Planetwood)
```css
:root {
  --primary-green: #4e8c6d;
  --dark-bg: #283436;
  --surface: rgba(60, 72, 74, 0.9);
  --white-text: #ffffff;
  --muted-text: rgba(255, 255, 255, 0.6);
  --accent-hover: #5da37d;
  --border-color: rgba(255, 255, 255, 0.1);
  --radius: 8px;
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --focus-outline: #4e8c6d;
}
```

## Animation Data Source
The decoded animations live at `public/decoded_animations.json` (21MB, 59 entries). Each entry has:
- **name**: string (e.g., "avatar_idle_01", "npc_rabbit_hop", "bird_flap")
- **duration**: float (seconds)
- **fps**: integer (typically 24)
- **frames**: array of frame objects
  - Each frame has: `boneIndex`, `position` [x,y,z], `quaternion` [x,y,z,w], `scale` [x,y,z]
- **hierarchy**: array of `{ boneIndex, parentIndex }` — **1-based parent index** (0 = root)

Key facts for the spec:
- **20 NPC types + 1 avatar** = 21 unique skeletons
- **36 animation clips** total (some NPCs share clips)
- **Bone count varies** per entity (avatar ~40 bones, birds ~15, butterflies ~8)
- **Animation format**: per-frame bone-indexed arrays + 1-based hierarchy parent indices
- **Quaternion order**: [x, y, z, w] (Three.js `Quaternion.fromArray()` default)
- **Target playback**: 24 FPS for NPCs, 30-60 FPS for avatar

## Required Output Structure

### 1. Overview Dashboard (Top of Page)
- Summary stats: 21 skeletons, 36 clips, 24 FPS target
- Search/filter by: entity type (avatar/NPC/bird/butterfly), clip category (idle/move/emote/special), duration range
- Color-coded badges: 🟢 Idle, 🔵 Move, 🟣 Emote, 🟠 Special

### 2. Per-Clip Detail Cards (Grid Layout)
Each clip gets a card with:

#### Visual Preview Area
- **Animated SVG skeleton** (simplified stick-figure using bone positions from frame 0 and middle frame)
  - Show bone hierarchy as lines between joints
  - Show joint positions as circles (size = bone influence)
  - **Play/pause/scrub controls** for the animation timeline
  - Frame counter: `Frame X / Y (ZZ.ZZs)`
- **Timeline ruler** below skeleton:
  - Tick marks at keyframes (where pose changes significantly)
  - Colored segments: green=root motion, blue=upper body, orange=limbs
  - Hover tooltip: exact time, bone transforms

#### Technical Specs Table
| Property | Value |
|---|---|
| Clip Name | `avatar_idle_01` |
| Entity | Avatar |
| Category | Idle |
| Duration | 3.42s |
| Frame Count | 82 |
| FPS | 24 |
| Bone Count | 42 |
| Root Motion | Yes/No |
| Loops Cleanly | Yes/No (detect first/last frame delta < 0.01) |
| Key Poses | Frame 0, 20, 41, 61, 81 (thumbnails) |

#### Easing Curve Visualization
- **Per-bone easing curves** (position X/Y/Z, quaternion W/X/Y/Z, scale X/Y/Z)
- Show as small sparkline charts (one per transform channel)
- Highlight channels with most variation
- Export as CSV button for engineers

#### Bone Hierarchy Diagram
- Tree view of bone names (if available) or indices
- Color-code by body part: root=black, spine=blue, arms=green, legs=orange, head=red
- Show parent→child relationships with indentation
- Mark bones with animation data vs. static

#### Integration Notes (for AnimationSystem.js)
```javascript
// Code snippet template for this clip
const clipData = {
  name: 'avatar_idle_01',
  duration: 3.42,
  fps: 24,
  tracks: {
    // Generated from decoded JSON - show structure
    0: { position: [...], quaternion: [...], scale: [...] }, // bone 0
    1: { position: [...], quaternion: [...], scale: [...] }, // bone 1
    // ...
  },
  hierarchy: [0, 0, 1, 2, 3, 1, 5, 6, ...] // 1-based parent indices
};
```

### 3. Skeleton Comparison View
- Side-by-side: Avatar vs. each NPC type skeleton overlay
- Show bone count differences
- Highlight shared vs. unique bones
- Table: NPC Type | Bone Count | Shared with Avatar | Unique Bones

### 4. Animation Categories Summary
Group clips by category with aggregate stats:

| Category | Clip Count | Avg Duration | Entity Types | Loop % |
|---|---|---|---|---|
| Idle | 12 | 3.2s | All | 100% |
| Move | 8 | 1.8s | Avatar, NPCs | 100% |
| Emote | 10 | 2.1s | Avatar, some NPCs | 60% |
| Special | 6 | 4.5s | Specific NPCs | 30% |

### 5. Export/Download Section
- **Download all specs as JSON** (structured for AnimationSystem consumption)
- **Download CSV** of all clips with technical columns
- **Copy Three.js AnimationClip factory code** for selected clip

## Interactive Features
1. **Search/filter** clips by name, entity, category, duration
2. **Play/pause/scrub** each clip's skeleton animation
3. **Hover bone** in hierarchy → highlights in skeleton preview
4. **Click bone** → shows per-frame transform table for that bone
5. **Keyboard nav**: Arrow keys between clips, Space to play/pause, / to focus search
6. **Reduced motion**: `@media (prefers-reduced-motion)` disables auto-play, shows static poses

## Visual Design
- Dark theme matching Planetwood (`--dark-bg`, `--surface`)
- Cards in responsive CSS Grid (1col mobile, 2col tablet, 3col desktop)
- Sticky header with search
- Skeleton preview uses CSS custom properties for colors
- Smooth transitions, focus-visible outlines
- Print stylesheet for PDF export (A4, landscape)

## Accessibility
- All interactive elements keyboard accessible
- `aria-live="polite"` for clip info updates
- `role="img"` + `aria-label` for skeleton SVGs
- Color-blind safe palette for bone categories
- Screen reader: table headers, form labels, button names

## Technical Implementation
- **Single HTML file** (no external deps)
- **Vanilla JS** (no frameworks)
- **Data embedded as JSON** in `<script type="application/json">` block
- Skeleton rendering: inline SVG with `requestAnimationFrame` loop
- Easing curves: Canvas or SVG paths (whichever lighter)
- All animations pause when tab hidden (`visibilitychange`)

## Data Source
You have the full decoded JSON at `~/webproject/messenger.abeto/decoded_animations_clean.json` (synced to `public/decoded_animations.json`). The prompt assumes you'll extract the 36 unique clips and 21 skeletons from it.

If you cannot read the JSON, create **representative mock data** for:
- Avatar: idle_01, idle_02, walk, run, jump, wave, dance, sit, sleep, point, clap, laugh (12 clips, ~42 bones)
- Rabbit NPC: idle, hop, sniff, eat (4 clips, ~28 bones)
- Bird NPC: idle, flap, glide, peck (4 clips, ~15 bones)
- Butterfly NPC: idle, flutter, land (3 clips, ~8 bones)
- 4 more NPC types with 3-4 clips each
- Total: ~36 clips across 21 skeletons

## Output File
`public/ui/animation-specs.html` — ready to open in browser and share with the team.