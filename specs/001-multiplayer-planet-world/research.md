# Research: Multiplayer Planet World

## Technical Decisions

### Rendering Pipeline

**Decision**: Three.js r185 with WebGL2 renderer, ACESFilmic tone mapping, PCFSoft shadows.
**Rationale**: Matches the original messenger.abeto approach. ACESFilmic provides film-like
color grading. PCFSoft shadows balance quality and performance.
**Alternatives considered**: WebGPU renderer (Three.js r185 has experimental support but
not stable enough), Babylon.js (heavier, different API surface).

### Runtime Skin & Animation System

**Decision**: Replicate `createSkin()` and `createSkinAnimation()` from the original game JS.
**Rationale**: The decoded Draco data (21MB JSON) is structured exactly for this approach —
the game already uses this exact pipeline. Bone rest poses come from `decoded_animations.json`
(position + quaternion + scale per bone). Per-frame animation tracks are bone-indexed
(`bone_N.position`, `bone_N.quaternion`, `bone_N.scale`). Hierarchy is stored as a 1-based
parent index attribute (0 = root).
**Alternatives considered**: Pre-baking animations into glTF (would require re-exporting
from Blender every time), using Three.js AnimationMixer directly with exported clips.

### Multiplayer Networking

**Decision**: Local Node.js WebSocket relay for peer discovery + P2P WebRTC for state sync.
**Rationale**: WebSocket relay handles initial handshake, room management, and ICE candidate
exchange. Real-time position/chat data goes over direct P2P WebRTC data channels for low
latency. This is the standard WebRTC signaling pattern used by messenger.abeto, PlayroomKit,
and most P2P web games.
**Alternatives considered**: Full server-authoritative (adds latency, requires game server),
pure P2P without relay (harder to discover peers), Socket.io (heavier than raw ws).

### Player Identity

**Decision**: Adjective-animal names (e.g., "BraveFox") assigned by relay, unique per session.
**Rationale**: No account system in v1. Random names are fun, memorable, and avoid the need
for authentication. Relay guarantees uniqueness by appending a number if collisions occur.

### Animation Data Layout

**Decision**: The decoded JSON follows the original Draco decoder output format:
- Each entry has `attributes.position`, `attributes.quaternion`, `attributes.scale` arrays
- For bone files: single frame of data (rest pose), plus `attributes.hierarchy` for parent indices
- For animation files: multi-frame data with `info.userData.frames` and `info.userData.fps`
- Data layout: `(frameIndex * numBones + boneIndex) * components`
- Quaternion format: [x, y, z, w] (Three.js Quaternion.fromArray default)
**Rationale**: Must match the game's `createSkin()` and `createSkinAnimation()` expectations.
The GLTFLoader/DRACOLoader approach would not work with decoded JSON.

### Performance Strategy

**Decision**: InstancedMesh for repeated objects (grass, butterflies), skeleton pooling for NPCs,
code-split multiplayer code from the main scene bundle, lazy-load animation data.
**Rationale**: The 21MB decoded JSON is loaded at startup in v1. Future optimization can
stream per-NPC animation data on demand. InstancedMesh reduces draw calls for repeated assets.
3D meshes already use three-mesh-bvh for raycasting and collision.

### Accessibility

**Decision**: Keyboard navigation (tab order, focus indicators, WASD/menu navigation),
screen reader announcements for key events via aria-live regions.
**Rationale**: Required by constitution (per messenger.abeto standards). Chat messages,
player join/leave, and connection status changes use aria-live polite regions.
