# Implementation Plan: Multiplayer Planet World

**Branch**: `main` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-multiplayer-planet-world/spec.md`

## Summary

Recreate messenger.abeto's 3D planet scene as a multiplayer web game using Three.js + Vite.
Players load a shared 3D planet, roam freely with WASD controls, see NPCs with idle
animations, encounter other players in real-time (WebRTC), and chat via proximity-based text.

Primary requirement: a playable, explorable 3D planet world with multiplayer presence.
Technical approach: load glTF scene + decoded Draco animation JSON at runtime, build
skinned meshes via `createSkin()`/`createSkinAnimation()` (matching original game's data
model), and use a local Node.js WebSocket relay + P2P WebRTC for multiplayer sync.

## Technical Context

**Language/Version**: JavaScript ES2024 (client + relay server), Node.js 18+
**Primary Dependencies**: Three.js r185, ws (WebSocket relay), PlayroomKit or PeerJS (WebRTC signaling), three-mesh-bvh
**Storage**: N/A (no persistence in v1 — ephemeral sessions only)
**Testing**: Manual browser testing (open multiple windows/tabs). No automated test framework in v1.
**Target Platform**: Modern browsers with WebGL2 + WebRTC (Chrome, Firefox, Edge, Safari)
**Project Type**: Web application (Vite frontend) + Node.js WebSocket relay server
**Performance Goals**: 60fps target (30fps floor), 5s initial load, 500ms multiplayer sync latency, 24fps NPC animations
**Constraints**: <200MB memory, <50MB total asset size, no game engines (Three.js only), keyboard navigable, screen reader compatible
**Scale/Scope**: Up to 10 simultaneous players, 20 NPC types + 1 avatar, 36 animation clips

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Rationale |
|-----------|--------|-----------|
| I. Spec-Driven Development | ✅ Pass | Spec completed; plan derives from it directly |
| II. Data-Driven Architecture | ✅ Pass | All assets (glTF, JSON) loaded at runtime; no hardcoded data |
| III. Performance-First | ✅ Pass | 60fps target, 30fps floor, 5s load time specified |
| IV. Modular Systems | ✅ Pass | Scene/Animation/Multiplayer/NPC/Input/UI as separate systems |
| V. Multiplayer + Accessibility | ✅ Pass | WebRTC multiplayer, keyboard nav, screen reader support scoped |

**No violations.** Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-multiplayer-planet-world/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Technical research & decisions
├── data-model.md        # Phase 1: Data model & state machines
├── quickstart.md        # Phase 1: Validation guide
├── contracts/           # Phase 1: WebSocket signaling protocol
│   └── signaling-protocol.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # (created by /speckit.tasks)
```

### Source Code (repository root)

```text
planetwood/
├── index.html            # Entry point
├── vite.config.js        # Vite config
├── package.json          # Dependencies
├── server/               # Node.js WebSocket relay
│   ├── index.js          # Relay entry point
│   └── package.json
├── public/
│   ├── scene.gltf        # 3D planet scene
│   ├── scene.bin         # glTF binary buffer
│   └── decoded_animations.json  # Decoded Draco animation/bone data
└── src/
    ├── main.js           # App entry (scene setup, game loop)
    ├── systems/
    │   ├── SceneSystem.js       # Loads & manages 3D scene
    │   ├── AnimationSystem.js   # createSkin/createSkinAnimation
    │   ├── PlayerInput.js       # WASD + keyboard controls
    │   ├── MultiplayerSystem.js # WebRTC + relay signaling
    │   ├── ChatSystem.js        # Proximity chat
    │   ├── NPCSystem.js         # NPC placement & animation
    │   └── UISystem.js          # UI overlay (OpenDesign)
    └── entities/
        ├── PlayerAvatar.js      # Player in-world representation
        └── NPC.js               # NPC in-world representation
```

**Structure Decision**: Single repository with client (Vite) + server (Node.js relay).
The relay is bundled in the same repo for local development simplicity. Production
deployment would extract the relay to a persistent host.

## Complexity Tracking

No violations — structure is appropriate for scope.
