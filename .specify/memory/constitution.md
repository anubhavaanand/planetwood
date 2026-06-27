# Planetwood Constitution

## Core Principles

### I. Spec-Driven Development

Every feature starts with a spec. No code before spec. Phases: Constitution → Specify → Plan → Tasks → Implement. All changes trace back to a spec decision.

### II. Data-Driven Architecture

All 3D assets loaded at runtime — scene.gltf, decoded_animations.json. No hardcoded positions, animations, or bone hierarchies. Matches the original messenger.abeto game's own approach: `createSkin()` and `createSkinAnimation()` read everything from decoded Draco data.

### III. Performance-First

60fps target on mid-range hardware. Optimized draw calls, instanced rendering for repeated objects (grass, butterflies, NPCs), LOD where needed. Web game must load fast — glTF compressed, textures optimized, code-split.

### IV. Modular Systems

SceneLoader, AnimationSystem, MultiplayerNetworking, InputSystem, NPCSystem, UISystem — each independent, testable, with clean interfaces. No god objects. Systems communicate via events/state, not direct coupling.

### V. Multiplayer, Accessibility, Authentic Recreation

**Multiplayer from day one**: players roam, meet, chat in shared world. WebRTC-based P2P or minimal relay.

**Accessibility**: keyboard navigation, screen reader support, per messenger.abeto standards — color contrast, focus indicators, text alternatives.

**Whitewash**: recreate the spirit authentically but make it feel new — original name (Planetwood), original art direction, Planetwood's own identity. Not a clone — a spiritual successor.

## Section 2: Tech Stack

Three.js r185 + Vite 8, ES modules. WebRTC for multiplayer (CarverJS or raw PeerJS). Three.js addons for GLTF, DRACO, KTX2. No external game engines (Unity, Unreal, Godot). OpenDesign for UI component system. Blender via MCP for asset preparation.

## Section 3: Development Workflow

Spec Kit phases → OpenDesign for UI → Implement. Git feature branches from `main`. All PRs gated by spec compliance (run `/speckit.analyze` before merge). Conventional commits. CI runs lint, typecheck, and build.

## Governance

Constitution supersedes all other practices. Amendments require: (1) updated spec, (2) `/speckit.analyze` pass, (3) approval. Versioning: MAJOR for principle removal/redefinition, MINOR for new principle/section, PATCH for clarifications. Compliance review on every PR via `/speckit.analyze`.

**Version**: 1.0.0 | **Ratified**: 2026-06-27 | **Last Amended**: 2026-06-27

<!-- Sync Impact Report
Version: 0.0.0 → 1.0.0 (initial ratification)
Principles defined: 5 core principles + 2 sections + Governance
Templates requiring updates: ✅ plan-template.md, ✅ spec-template.md, ✅ tasks-template.md
Follow-up TODOs: none
-->