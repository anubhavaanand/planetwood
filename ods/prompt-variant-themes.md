# OpenDesign Prompt: Planetwood Variant Themes

## Mission
Create a visual theme explorer demonstrating alternative color schemes for Planetwood. Each theme must be fully functional — apply it to all 11 UI components and show before/after comparisons. The themes should be usable as CSS custom property overrides in the game engine.

## Base Theme (Planetwood Default)
```css
:root {
  --primary-green: #4e8c6d;
  --dark-bg: #283436;
  --surface: rgba(60, 72, 74, 0.9);
  --white-text: #ffffff;
  --muted-text: rgba(255, 255, 255, 0.6);
  --accent-hover: #5da37d;
  --border-color: rgba(255, 255, 255, 0.1);
  --error-red: #c0392b;
  --warning-amber: #f39c12;
  --success-green: #4e8c6d;
  --info-blue: #3498db;
  --radius: 8px;
  --font-body: system-ui, -apple-system, sans-serif;
}
```

## Required Themes (5 total)

### Theme 1: High Contrast (Accessibility)
**Purpose**: WCAG AAA compliance for users with low vision
**Changes**:
- All text contrast ratio ≥ 7:1
- Remove backdrop-filter (causes contrast issues)
- Buttons have solid backgrounds, not transparent
- Status dots: larger (12px), use shape+color (not just color)
- Borders: 2px solid instead of 1px
- Focus indicators: 3px solid yellow outline
- Backgrounds: darker (#1a202c) or lighter (#f5f5f5) based on user preference
- **Offer two sub-variants**: High Contrast Dark / High Contrast Light

```css
[data-theme="high-contrast-dark"] {
  --dark-bg: #0a0a0a;
  --surface: #1a1a1a;
  --white-text: #ffffff;
  --muted-text: #cccccc;
  --border-color: #555555;
  --primary-green: #00e676;
  --error-red: #ff1744;
  --warning-amber: #ffd600;
  --focus-outline: 3px solid #ffd600;
}
```

**Affected components**: All — needs text contrast pass, border visibility, focus indicators

### Theme 2: Colorblind Friendly (Dyslexia & CVD)
**Purpose**: Red-green colorblind (deuteranopia/protanopia) and tritanopia safe
**Changes**:
- Replace green status indicators with blue + shape (filled circle vs hollow)
- Error: use red + X icon, not just red
- Success: use blue + checkmark, not just green
- Status dots: add shape distinction (circle=online, diamond=away, square=offline)
- Avoid green/red pair for any critical information
- Use blue/orange as primary distinction pair

```css
[data-theme="colorblind-safe"] {
  --primary-green: #0077bb; /* blue instead of green */
  --accent-hover: #0099dd;
  --error-red: #cc3311;
  --success-green: #0077bb; /* blue = success */
  --warning-amber: #ee7733; /* orange = warning */
  --info-blue: #33bbee;
}
```

**Affected components**: HUD (connection indicator), notifications (type colors), player list (status dots), nameplates (status dots)

### Theme 3: Winter / Aurora (Seasonal)
**Purpose**: December/January seasonal event — cool blue-white palette
**Changes**:
- Replace green with ice blue (#77ddff)
- Dark bg shifts to deep navy (#0a1628)
- Add subtle snow particle effect (CSS only, on `--dark-bg`)
- Accents: silver (#c0c0c0), ice (#e0f0ff), aurora green (#00ff88) for specials
- Border radius: slightly larger (12px) for "frosted glass" feel

```css
[data-theme="winter-aurora"] {
  --primary-green: #77ddff;
  --dark-bg: #0a1628;
  --surface: rgba(20, 40, 70, 0.85);
  --white-text: #e0f0ff;
  --muted-text: rgba(200, 230, 255, 0.5);
  --accent-hover: #99eeff;
  --border-color: rgba(100, 200, 255, 0.15);
  --radius: 12px;
}
```

**HUD connection indicator**: Pulse animation like aurora borealis
**Visual extras**: Snowflake decoration on loading screen, ice border on nameplates, notification type icons get frost overlay

### Theme 4: Halloween / Spooky (Seasonal)
**Purpose**: October seasonal event — orange-purple-dark palette
**Changes**:
- Primary: orange (#ff6600) instead of green
- Background: near-black (#0d0d0d) with dark purple tint
- Accents: purple (#9933ff), glowing orange (#ff8800), neon green (#00ff00) for special
- Nameplates: dark purple background, orange border, "ghostly" glow
- Buttons: pumpkin orange with dark hover

```css
[data-theme="halloween-spooky"] {
  --primary-green: #ff6600;
  --dark-bg: #0d0d0d;
  --surface: rgba(30, 10, 40, 0.85);
  --white-text: #ffeedd;
  --muted-text: rgba(255, 200, 150, 0.5);
  --accent-hover: #ff8833;
  --border-color: rgba(255, 100, 0, 0.2);
  --error-red: #ff0000;
  --warning-amber: #ffaa00;
  --radius: 4px; /* sharper edges */
}
```

**Visual extras**: Loading screen planet becomes a pumpkin gradient, emote picker has web decorations, notification icons glow orange, status dots become jack-o-lantern style

### Theme 5: Celestial / Cosmic (Premium Alternative)
**Purpose**: Premium "showcase" theme for marketing — deep space with gold accents
**Changes**:
- Primary: gold (#ffd700) 
- Background: deep space (#050510) with starfield effect
- Accents: gold (#ffd700), cosmic purple (#9966ff), nebula pink (#ff66cc)
- Nameplates: gold border, subtle glow
- Cards: glassmorphism with gold border
- Loading screen: starfield animation + planet with rings

```css
[data-theme="celestial-cosmic"] {
  --primary-green: #ffd700;
  --dark-bg: #050510;
  --surface: rgba(15, 15, 40, 0.8);
  --white-text: #fff8e7;
  --muted-text: rgba(255, 215, 0, 0.4);
  --accent-hover: #ffe44d;
  --border-color: rgba(255, 215, 0, 0.15);
  --error-red: #ff3366;
  --warning-amber: #ffaa33;
  --radius: 16px; /* premium large radius */
}
```

**Visual extras**: Starfield CSS animation on body, gold shimmer on primary buttons, planet in loading screen has animated rings

---

## Output Requirements

### Page Layout

1. **Theme switcher bar** at top (horizontal pill buttons for each theme, plus "Base" default)
   - Click a theme → instantly re-themes all components below
   - URL hash updates (e.g., `#halloween-spooky`)
   - Theme persists across page reload (localStorage)

2. **Theme comparison grid**
   - Each theme shown as a card with:
     - Color palette swatches (named: primary, bg, surface, text, muted, accent, border, error, warning, info)
     - Font sample (sentence in body font)
     - Contrast ratio badge (AA/AAA/pass/fail for key pairs)
     - "Apply" button → applies theme to the live preview area
   
3. **Live preview area** (shows current theme applied to all components)
   - Miniature but functional version of each component rendered in the theme
   - Loading screen strip (progress at 60%)
   - HUD bar (3 players, FPS 60, good connection)
   - Nameplate example (online, away, offline variants)
   - Toast notification (system type)
   - Chat bubble
   - Player list (3 players)
   - Emote picker (open state)
   - Settings panel (open state)
   - Error screen (disconnect type)
   
4. **CSS custom properties export**
   - For each theme, show the complete `:root` or `[data-theme="..."]` CSS code block
   - "Copy CSS" button
   - "Download theme.json" button (structured token data for game engine consumption)
   
5. **Applicability matrix**
   - Table: Theme × Component — ✅ fully compatible, ⚠️ needs adjustments, ❌ not recommended
   - Notes on specific component changes per theme

### Interactive Features
- Smooth theme transitions (500ms, `transition: background-color 0.5s, color 0.5s`)
- Side-by-side comparison mode (select 2 themes, split screen)
- Accessibility overlay mode (simulate CVD vision types: deuteranopia, protanopia, tritanopia, grayscale)

### Accessibility
- Theme switcher is keyboard navigable (Tab, Arrow keys)
- Active theme announced via `aria-live`
- Contrast ratios calculated and displayed
- "High contrast" theme listed first (most important for accessibility)
- `prefers-reduced-motion`: no theme transition animation, instant switch

## Output File
`public/ui/variant-themes.html` — complete interactive theme explorer.