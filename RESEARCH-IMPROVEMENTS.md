# Planetwood: Research Findings & Improvement Roadmap

**Date**: 2026-07-01
**Source**: Online research + codebase analysis

## Current State Summary

- **1,376 lines** across 12 source files (11 client + 1 server)
- **87 DRC assets** (avatar + 20 NPC types)
- **27/29 tasks** complete (2 manual: perf + cross-browser)
- Core systems: Scene, Animation, MeshLoader, PlayerInput, NPCSystem, MultiplayerSystem, ChatSystem, UISystem

## Critical Bugs Fixed (2026-07-01)

### 1. Draco Decoder CDN → Local Files
**Problem**: MeshLoader used `https://www.gstatic.com/draco/versioned/decoders/1.5.6/` — CDN could be slow/blocked.
**Fix**: Copied decoder files to `public/draco/`, set path to `/draco/`.

### 2. Missing CSS2DRenderer
**Problem**: No HTML overlay for nameplates/chat bubbles — using canvas sprites only.
**Fix**: Added `CSS2DRenderer` to SceneSystem, `addNameplate()` to UISystem.

### 3. Server Missing displayName
**Problem**: Server's `joined` payload didn't include player's own displayName.
**Fix**: Added `displayName: player.displayName` to the payload.

### 4. Fallback Timer Race Condition
**Problem**: Timer could null multiplayer even if it just connected.
**Fix**: Added null check and proper disconnect before nulling.

---

## Improvement Recommendations (Priority Order)

### Phase 7: Performance Optimization (High Priority)

#### A. Draw Call Reduction
- **Target**: <100 draw calls per frame (currently unknown, need profiling)
- **Technique**: `InstancedMesh` for repeated objects (grass, butterflies, trees)
- **Technique**: `BatchedMesh` for varied geometries sharing materials
- **Technique**: `BufferGeometryUtils.mergeGeometries()` for static environment pieces
- **Tool**: Use `renderer.info.render.calls` to measure draw calls

```javascript
// Example: InstancedMesh for grass
const grassGeo = new THREE.PlaneGeometry(0.3, 0.3);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a });
const grassCount = 5000;
const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
const matrix = new THREE.Matrix4();
for (let i = 0; i < grassCount; i++) {
  matrix.setPosition(
    Math.random() * 100 - 50,
    0,
    Math.random() * 100 - 50
  );
  grass.setMatrixAt(i, matrix);
}
grass.instanceMatrix.needsUpdate = true;
scene.add(grass);
```

#### B. Texture Optimization
- Use KTX2 compression for all textures (2-4x smaller than PNG/JPG)
- Use texture atlases to reduce material count
- Use power-of-2 texture sizes for GPU efficiency
- Tool: `gltf-transform` for texture compression

#### C. Level of Detail (LOD)
- Implement `THREE.LOD` for NPCs and distant objects
- Far objects use simplified geometry (billboard impostors)
- Reduces triangle count without visual impact

#### D. Memory Management
- Dispose unused geometries, materials, textures
- Use `renderer.dispose()` on cleanup
- Pool skeleton objects for NPC reuse

### Phase 8: Multiplayer Improvements (High Priority)

#### A. WebRTC Mesh Scaling
- Current: Full mesh (each peer connects to every other)
- **Limit**: 4-5 peers with audio/video, 8 peers for data-only
- **Recommendation**: Hybrid approach for 10+ players
  - Use WebSocket relay for state sync (authoritative)
  - Use WebRTC DataChannel for low-latency chat/emotes
  - Consider SFU (mediasoup) for scaling beyond 8 players

#### B. State Synchronization
- Current: 12Hz position sync (every ~83ms)
- **Improvement**: Use interpolation buffer for smooth remote player movement
- **Improvement**: Use CRDTs for chat message ordering
- **Improvement**: Add lag compensation and rollback for competitive features

#### C. Connection Resilience
- Add automatic reconnection with exponential backoff
- Add heartbeat ping/pong to detect dead connections
- Add TURN server fallback for restrictive networks (15-20% of users need it)

#### D. Server Improvements
- Add Redis for session state persistence
- Add rate limiting on server side (prevent spam)
- Add player position validation (prevent teleport cheating)
- Add message broadcasting optimization (only send to nearby players)

### Phase 9: UI/UX Enhancements (Medium Priority)

#### A. CSS2DRenderer Optimization
- Current: New `CSS2DObject` per label (DOM overhead)
- **Improvement**: Pool label elements, reuse off-screen labels
- **Improvement**: Only render labels within viewport (projection check)
- **Improvement**: Use `pointer-events: none` on container for click-through

```javascript
// Viewport culling for labels
const pos = entity.position.clone().project(camera);
const visible = pos.x >= -1 && pos.x <= 1 && pos.y >= -1 && pos.y <= 1 && pos.z >= -1 && pos.z <= 1;
label.element.style.display = visible ? 'block' : 'none';
```

#### B. Chat System
- Add message history persistence (localStorage)
- Add emoji picker integration
- Add @mention system for targeting specific players
- Add message filtering/blocking (client-side)

#### C. HUD Elements
- Player count indicator
- Minimap with player/NPC positions
- Settings panel (graphics quality, controls)
- Emote picker with animation preview

### Phase 10: Asset Pipeline (Medium Priority)

#### A. Scene Optimization
- Use `gltf-transform` to optimize glTF:
  - Draco compression for geometry
  - KTX2 compression for textures
  - Remove unused nodes/animations
  - Split into lazy-loadable chunks

#### B. Animation Optimization
- Current: 22MB decoded_animations.json loaded at startup
- **Improvement**: Stream animations on demand (load NPC anims when nearby)
- **Improvement**: Use skeletal animation compression (reduce bone count)
- **Improvement**: Share animation clips between similar NPC types

#### C. Asset Loading Strategy
- Implement progressive loading (load visible area first)
- Use `THREE.LoadingManager` for coordinated asset loading
- Add service worker for offline caching
- Use HTTP/2 server push for critical assets

### Phase 11: New Features (Low Priority)

#### A. Web City Features (from spec User Story 4)
- **Billboards/Advertising**: CSS2DObject-based HTML overlays in 3D space
- **Networking Zones**: Trigger areas that increase chat radius or show UI prompts
- **Events System**: Seasonal decorations, mini-games, NPC-led activities
- **Virtual Shop**: Purchase avatar customizations (cosmetic only)

#### B. Player Interactions
- **Proximity Voice Chat**: WebRTC audio with spatial audio
- **Emote System**: Wave, dance, sit, etc. with animations
- **Trading System**: Exchange virtual items between players
- **Friend System**: Add/friend players, see online status

#### C. World Building
- **Custom Areas**: Players can build/place objects in designated zones
- **Event Hosting**: Create and schedule events in the world
- **NPC Quests**: Interactive NPCs with dialogue trees
- **Mini-Games**: Chess, cards, etc. accessible in-world

### Phase 12: Technical Infrastructure (Low Priority)

#### A. Testing
- Add Playwright for browser automation testing
- Add Vitest for unit testing game logic
- Add visual regression testing for UI components
- Add performance benchmarking (frame time, draw calls)

#### B. CI/CD
- GitHub Actions for automated testing
- Automated deployment to GitHub Pages
- Performance budgets in CI (max bundle size, max load time)
- Lighthouse CI for accessibility and performance

#### C. Monitoring
- Add error tracking (Sentry or similar)
- Add performance monitoring (frame drops, memory usage)
- Add analytics for player behavior
- Add crash reporting for mobile browsers

---

## Tools & Libraries to Consider

### Essential
- **`three-mesh-bvh`** (already in package.json): BVH acceleration for raycasting
- **`gltf-transform`**: Optimize/compress glTF files
- **`stats-gl`**: FPS and draw call monitoring (dev only)
- **`Spector.js`**: WebGL debugging and profiling

### Nice to Have
- **`troika-three-text`**: High-quality SDF text rendering
- **`@react-three/fiber`**: If migrating to React (optional)
- **`drei`**: Useful React Three Fiber helpers
- **`leva`**: GUI controls for development
- **`postprocessing`**: Bloom, DOF, color grading effects

### Performance
- **WebGPU Renderer**: Three.js r171+ supports WebGPU with WebGL fallback
- **KTX2 Loader**: GPU-compressed textures (2-4x smaller)
- **Basis Universal**: Texture compression for web
- **Draco Loader**: Already used for geometry compression

### Networking
- **PeerJS**: Simplified WebRTC (already considered)
- **Socket.IO**: WebSocket with fallback (alternative to raw ws)
- **mediasoup**: SFU for scaling beyond 8 players
- **Colyseus**: Authoritative multiplayer framework

---

## Quick Wins (Do Now)

1. **Profile draw calls**: Add `renderer.info.render.calls` logging
2. **Add dispose() calls**: Clean up geometries/materials on entity removal
3. **Viewport culling for labels**: Hide off-screen CSS2D labels
4. **LocalStorage chat history**: Persist recent messages across sessions
5. **Service worker**: Cache critical assets for offline support

---

## Long-term Vision

### The Web City Platform
Planetwood can evolve into a full web city platform with:

1. **Social Hub**: Players meet, chat, form communities
2. **Event Space**: Host concerts, meetups, conferences
3. **Commerce Layer**: Virtual shops, sponsorships, advertising
4. **Content Creation**: Players build/customize areas
5. **Integration Layer**: Connect to external services (Discord, Twitter, etc.)

### Technical Goals
- **60fps** on mid-range hardware (integrated GPU)
- **<3s** initial load time
- **<100ms** chat message latency
- **99.9%** uptime for multiplayer
- **<50MB** total asset size
