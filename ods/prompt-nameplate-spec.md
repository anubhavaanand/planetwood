# OpenDesign Prompt: Planetwood Nameplate CSS2DRenderer Spec

## Mission
Create a technical specification document for how player nameplates render in 3D space using Three.js CSS2DRenderer. This spec bridges the gap between the HTML/CSS nameplate component and its in-world 3D rendering, and will directly guide the implementation of chat bubble rendering (T020) and nameplate positioning.

## Brand Tokens (Planetwood)
```css
:root {
  --primary-green: #4e8c6d;
  --dark-bg: rgba(40, 52, 54, 0.7);
  --surface: rgba(60, 72, 74, 0.7);
  --white-text: #ffffff;
  --muted-text: rgba(255, 255, 255, 0.6);
  --accent-hover: #5da37d;
  --border: 1px solid rgba(255, 255, 255, 0.1);
  --radius: 12px;
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --status-dot-size: 8px;
  --badge-radius: 10px;
}
```

## Technical Context

### What is CSS2DRenderer?
- Three.js addon that renders HTML/CSS elements as 2D overlays positioned in 3D space
- Elements stay fixed size on screen regardless of distance (like a heads-up display)
- **Not** affected by scene lighting or depth — always on top of WebGL
- Part of Three.js examples/js/renderers/CSS2DRenderer.js (ESM import path: `three/examples/jsm/renderers/CSS2DRenderer.js`)

### Import Path (Three.js r185)
```javascript
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
```

## Nameplate Component (HTML/CSS Reference)

The nameplate HTML structure (from `public/ui/nameplate-mockup.html`):

```html
<div class="nameplate" style="transform: translate(-50%, -50%)">
  <div class="status-dot online"></div>
  <div class="player-name">BraveFox</div>
  <div class="you-badge">You</div>
</div>
```

CSS (from nameplate-mockup.css):
- `display: flex; align-items: center; gap: 8px`
- `padding: 4px 8px; border-radius: 12px`
- `background: rgba(60, 72, 74, 0.7); backdrop-filter: blur(4px)`
- `border: 1px solid rgba(255, 255, 255, 0.1)`
- `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)`
- `white-space: nowrap`
- `user-select: none`
- Status dot: `8px × 8px, border-radius: 50%`, colors: green/amber/red
- You badge: `background: var(--primary-green); font-size: 10px; border-radius: 10px`

## Required Output

### 1. CSS2DRenderer Integration Guide

#### Setup Code
```javascript
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// Create CSS2DRenderer (must render on top of WebGL)
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none'; // click-through to game
document.getElementById('game-container').appendChild(labelRenderer.domElement);

// In animate() loop:
labelRenderer.render(scene, camera);
```

#### Nameplate Factory Function
```javascript
function createNameplate(player) {
  // Create container element
  const div = document.createElement('div');
  div.className = 'nameplate';
  div.id = `nameplate-${player.id}`;
  div.setAttribute('role', 'status');
  div.setAttribute('aria-label', `${player.name} - ${player.status}`);

  // Status dot
  const dot = document.createElement('div');
  dot.className = `status-dot ${player.status}`;
  div.appendChild(dot);

  // Player name
  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = player.displayName;
  div.appendChild(name);

  // "You" badge (only for local player)
  if (player.isLocal) {
    const badge = document.createElement('span');
    badge.className = 'you-badge';
    badge.textContent = 'You';
    div.appendChild(badge);
  }

  // Create CSS2DObject attached to avatar's head bone
  const label = new CSS2DObject(div);
  label.position.set(0, headHeight, 0); // offset above avatar

  return label;
}
```

### 2. Positioning & Offset Specs

#### Avatar Head Height Mapping
| Entity Type | Head Bone Index | Offset Y (units) | Nameplate Scale |
|---|---|---|---|
| Avatar (humanoid) | 10 (or head joint) | 2.2 | 1.0 |
| Rabbit NPC | 5 | 1.0 | 0.7 |
| Bird NPC | 3 | 0.6 | 0.5 |
| Butterfly NPC | 2 | 0.3 | 0.4 |
| Bear NPC | 8 | 1.8 | 0.9 |

#### Billboard Behavior
- Nameplate always faces camera (CSS2DRenderer does this by default ✅)
- No rotation interpolation needed
- Distance scaling: CSS2DObjects are fixed pixel size — no perspective scaling
- **Alternative**: For depth perception, scale nameplate based on camera distance:
  ```javascript
  const dist = camera.position.distanceTo(label.position);
  const scale = Math.max(0.5, Math.min(1.5, 10 / dist));
  div.style.transform = `scale(${scale})`;
  ```

### 3. Z-Order & Layering

Since CSS2DRenderer places elements in document order by default, nameplates of closer players should appear on top:

#### Depth Sorting
```javascript
// Before each render, sort nameplates by distance to camera
function sortNameplates() {
  const nameplates = playerNameplateGroup.children;
  nameplates.sort((a, b) => {
    const distA = camera.position.distanceTo(a.position);
    const distB = camera.position.distanceTo(b.position);
    return distB - distA; // farthest first, closest last (on top)
  });
  // Reorder in DOM by setting z-index or re-inserting elements
  nameplates.forEach((np, i) => {
    np.element.style.zIndex = i;
  });
}
```

**Layer order** (from back to front):
1. WebGL scene (z-index 0)
2. CSS2DRenderer container (z-index 1, pointer-events: none)
3. HUD (z-index 150)
4. Chat log (z-index 300)
5. Player list (z-index 400)
6. Emote picker (z-index 500)
7. Settings (z-index 600)
8. Error screen (z-index 10000)
9. Loading screen (z-index 20000)

### 4. Chat Bubble Integration (T020)

Chat bubbles are CSS2DObjects attached above nameplates:
```javascript
function createChatBubble(senderId, senderName, text) {
  const div = document.createElement('div');
  div.className = 'chat-bubble';
  div.innerHTML = `
    <div class="bubble-name">${escapeHtml(senderName)}</div>
    <div class="bubble-text">${escapeHtml(text)}</div>
    <div class="bubble-tail"></div>
  `;
  const bubble = new CSS2DObject(div);
  bubble.position.set(0, headHeight + 0.8, 0); // above nameplate
  return bubble;
}
```

**Lifecycle**:
1. Show: bubble appears with opacity 0→1 over 200ms
2. Display: stays 5 seconds
3. Fade: opacity 1→0 over 300ms, then remove from scene

**Positioning math**: 
- Nameplate Y = `avatar.position.y + headHeightOffset`
- Bubble Y = `avatar.position.y + headHeightOffset + 0.8`
- Z-sorting: bubbles sort above their own nameplate

### 5. State Management

```javascript
class NameplateManager {
  constructor(scene) {
    this.nameplates = new Map(); // playerId -> CSS2DObject
    this.group = new THREE.Group();
    this.group.name = 'nameplates';
    scene.add(this.group);
  }

  addPlayer(player) {
    const label = createNameplate(player);
    this.nameplates.set(player.id, label);
    this.group.add(label);
  }

  removePlayer(playerId) {
    const label = this.nameplates.get(playerId);
    if (label) {
      this.group.remove(label);
      label.element.remove();
      this.nameplates.delete(playerId);
    }
  }

  updatePlayerPosition(playerId, position, headHeight) {
    const label = this.nameplates.get(playerId);
    if (label) {
      label.position.copy(position);
      label.position.y += headHeight;
    }
  }

  updatePlayerStatus(playerId, status) {
    const label = this.nameplates.get(playerId);
    if (label) {
      const dot = label.element.querySelector('.status-dot');
      dot.className = `status-dot ${status}`;
    }
  }

  updateBeforeRender(camera) {
    // Depth sort
    this.sortByDistance(camera);
  }
}
```

### 6. Chat Bubble Manager (T020 Integration)

```javascript
class ChatBubbleManager {
  constructor(scene, nameplateManager) {
    this.bubbles = new Map(); // playerId -> { bubble, timeout }
    this.group = new THREE.Group();
    this.group.name = 'chat-bubbles';
    scene.add(this.group);
  }

  showMessage(senderId, senderName, text, position, headHeight) {
    // Remove existing bubble for this sender
    this.removeBubble(senderId);
    
    const bubble = createChatBubble(senderId, senderName, text);
    bubble.position.set(position.x, position.y + headHeight + 0.8, position.z);
    this.group.add(bubble);
    
    // Auto-remove after 5 seconds
    const timeoutId = setTimeout(() => this.removeBubble(senderId), 5000);
    this.bubbles.set(senderId, { bubble, timeoutId });
  }

  removeBubble(playerId) {
    const existing = this.bubbles.get(playerId);
    if (existing) {
      clearTimeout(existing.timeoutId);
      this.group.remove(existing.bubble);
      existing.bubble.element.remove();
      this.bubbles.delete(playerId);
    }
  }
}
```

### 7. Performance Considerations

- **CSS2DRenderer creates real DOM elements** — 1000 elements will lag; with 10 max players this is fine
- **Memory**: Destroy nameplate elements when players leave (see removePlayer above)
- **Layout thrashing**: Batch DOM reads/writes via requestAnimationFrame
- **reducedMotion**: `@media (prefers-reduced-motion: reduce)` — skip fade animations, just show/hide instantly
- **renderOrder**: Set on the CSS2DObject to control overlay draw order
  ```javascript
  label.renderOrder = 1; // always on top of WebGL meshes
  ```

### 8. Troubleshooting Guide

| Issue | Cause | Fix |
|---|---|---|
| Nameplate not showing | CSS2DRenderer not in render loop | Add `labelRenderer.render(scene, camera)` to animate() |
| Nameplate behind WebGL | CSS2DRenderer DOM element z-index too low | Set `labelRenderer.domElement.style.zIndex = '1'` |
| Click events blocked | pointer-events set to 'none' | Set only on container, enable on interactive children |
| Nameplate jitters | Layout thrashing from reflow | Batch reads/writes, use transform instead of top/left |
| Chat bubble cuts off | overflow:hidden on parent | Ensure CSS2DRenderer parent has `overflow: visible` |
| Wrong position in VR | CSS2DRenderer not VR-aware | Hide nameplates in VR mode, use sprite text instead |

---

## Output Format
A single HTML file containing:
1. **Interactive 3D preview** — a small Three.js scene (without full game engine, just OrbitControls + a few sphere avatars) that demonstrates CSS2DRenderer nameplates working in real-time
2. **Working code examples** — copy-paste-ready JavaScript factory functions
3. **Visual diagrams** — position offset diagrams, layer order visualization, lifecycle flowchart
4. **Integration guide** — step-by-step to add nameplates to existing Planetwood codebase
5. **Chat bubble demo** — click avatars to show bubbles, verify z-ordering

## File Output
`public/ui/nameplate-css2d-spec.html` — interactive demo + technical documentation