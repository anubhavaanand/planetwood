# Tasks: Multiplayer Planet World

**Input**: Design documents from `specs/001-multiplayer-planet-world/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual browser testing only (per plan.md). No automated test framework in v1.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Initial State**: Vite project exists with Three.js, scene setup, glTF loader in `src/main.js`. Assets (`scene.gltf`, `scene.bin`, `decoded_animations.json`) present in `public/`. No `server/` directory yet. No modular systems structure.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and server scaffold

- [X] T001 Create server/ directory with `package.json` (ws dependency, Node.js 18+) at `server/package.json`
- [X] T002 [P] Create `src/systems/` directory for modular system files
- [X] T003 [P] Create `src/entities/` directory for entity classes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement WebSocket relay server in `server/index.js` per signaling-protocol.md (join, signal, leave message handling, session management, player ID assignment)
- [X] T004b Add `dev:server` script to root `package.json` — `"dev:server": "node server/index.js"` (per spec assumption line 133)
- [X] T005 Refactor scene setup from `src/main.js` into `src/systems/SceneSystem.js` (scene/camera/renderer/lighting creation, glTF loader, animation data fetch, resize handler)
- [X] T006 Implement AnimationSystem in `src/systems/AnimationSystem.js` — `createSkin(boneData)` builds bone hierarchy from decoded JSON (1-based parent index), `createSkinAnimation(animData, skeleton)` creates per-frame animation tracks. Supports 20 NPC types + 1 avatar, 36 animation clips.
- [X] T007 Create `src/entities/PlayerAvatar.js` — class with id, displayName, position, rotation, animationState, Three.js group with skinned mesh
- [X] T008 Create `src/entities/NPC.js` — class with id, npcType, displayName, fixed position, animationClips, Three.js group with skinned mesh

**Checkpoint**: Foundation ready — scene loads, animations decode, entities created. User story implementation can begin.

---

## Phase 3: User Story 1 - Roam the Planet (Priority: P1) 🎯 MVP

**Goal**: Player opens Planetwood, sees a 3D planet with NPCs, moves freely with WASD/arrow keys, orbits camera with mouse drag. Single-player offline mode works.

**Independent Test**: Load page, verify 3D planet renders with terrain/sky/ambient elements within 5s. Move with WASD. Observe at least one NPC playing idle animation. Rotate camera with mouse drag — no terrain clipping.

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement PlayerInput system in `src/systems/PlayerInput.js` — WASD + arrow keys for movement, mouse drag for orbit camera, Enter for chat trigger, Tab for UI navigation
- [X] T010 [P] [US1] Implement NPCSystem in `src/systems/NPCSystem.js` — load NPC placement data from scene glTF, create NPC entities with AnimationSystem, loop idle animations
- [X] T011 [US1] Wire US1 systems into game loop in `src/main.js` — instantiate SceneSystem, AnimationSystem, PlayerInput, NPCSystem; update loop calls input → move camera → animate NPCs → render
- [X] T012 [US1] Implement loading screen states in `index.html` and `src/main.js` — show progress during glTF load, hide on scene ready; handle load failure with error message (FR-001)

**Checkpoint**: US1 complete — single-player planet roam works independently. No multiplayer, no chat, no server needed.

---

## Phase 4: User Story 2 - Meet Other Players (Priority: P2)

**Goal**: Multiple players see each other as animated avatars in real-time with <500ms sync latency. Players can wave/emote. Disconnection handling and single-player fallback work.

**Independent Test**: Open two browser windows side-by-side. Both appear in same world. Moving Player A updates within 500ms on Player B. Close one window — avatar disappears within 3s. Start server with relay off — single-player fallback notification appears.

### Implementation for User Story 2

- [X] T013 [P] [US2] Implement MultiplayerSystem in `src/systems/MultiplayerSystem.js` — WebSocket client connects to relay at `ws://localhost:3001`, handles join/peer_joined/peer_left/signal messages per signaling-protocol.md; establishes WebRTC peer connections via DataChannel for state sync
- [X] T014 [US2] Create WebRTC peer connection manager in `src/systems/MultiplayerSystem.js` — RTCPeerConnection setup, ICE candidate exchange via relay, DataChannel creation for `state` messages (~12 Hz position/rotation/animation sync) per signaling-protocol.md
- [X] T015 [US2] Integrate remote player rendering — on `peer_joined` create PlayerAvatar entity with remote player's data, on `peer_left` remove avatar within 3s; sync remote position/rotation/animation states each frame (FR-005, FR-006, FR-008)
- [X] T016 [US2] Implement single-player fallback mode — if WebSocket connection fails or times out after 5s, disable MultiplayerSystem and show notification overlay "Multiplayer unavailable — exploring alone" (FR-011)
- [X] T017 [US2] Add dev logging to MultiplayerSystem — log connection state changes, peer join/leave, sync errors to console; strip via Vite `import.meta.env.PROD` or dead-code elimination (FR-013)
- [X] T017b [US2] Implement "away" idle state — when browser tab is backgrounded for 30s, set local player animation to idle and notify peers; restore on tab focus (edge case 3)

**Checkpoint**: US1 + US2 complete — multiplayer roam works. Two players see each other and sync positions.

---

## Phase 5: User Story 3 - Chat with Nearby Players (Priority: P3)

**Goal**: Players send/receive text messages. Messages appear above sender's avatar as bubbles and in chat log. Proximity-based: only players within configurable radius (default 20 units) see messages. Client-side rate limit 1 msg/2s.

**Independent Test**: Open three browser windows. Position two close, one far. Send message from close player — bubble + log on both close players, NOT on distant player. Rate limit: rapidly send 3 messages — only first and third appear.

### Implementation for User Story 3

- [X] T018 [P] [US3] Implement ChatSystem in `src/systems/ChatSystem.js` — proximity check (distance vs configurable radius), chat message queue, rate limiter (1 msg/2s), data channel send/receive for `chat` messages per signaling-protocol.md
- [X] T019 [US3] Create chat input UI in `src/systems/UISystem.js` — Enter to open input field, Enter to send, ESC to close; text input element positioned at bottom of screen; keyboard-navigable (FR-009)
- [X] T020 [US3] Add chat bubble rendering above avatars (own + remote) — floating text sprite or HTML overlay positioned at avatar head height; appears for N seconds then fades
- [X] T021 [US3] Add chat log panel — scrollable list of recent messages (sender name + text), positioned at screen corner; auto-scroll to bottom on new message; max messages to prevent overflow

**Checkpoint**: US1 + US2 + US3 complete — full social experience. Roam, see players, chat with nearby.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T022 [P] Implement keyboard navigation for all UI elements (chat input, notifications, menu buttons) with visible focus indicators and Tab order (FR-009)
- [X] T023 [P] Implement screen reader announcements — `aria-live="polite"` region for connection status changes, player join/leave, new chat messages; announce within 1s of event (FR-010, SC-005)
- [X] T024 Update `vite.config.js` for production — code-split multiplayer bundle from main scene bundle, set `build.target` to ES2020 for broader browser support
- [ ] T025 Performance optimization pass — verify InstancedMesh for repeated grass/butterflies, skeleton pooling for NPCs, texture compression for glTF assets; profile with Chrome DevTools; target 30fps floor with 10+ players (FR-012, SC-006) [MANUAL]
- [ ] T026 [P] Validate all 5 scenarios from `quickstart.md` pass in Chrome, Firefox, Edge [MANUAL]
- [X] T027 [P] Clean up console.log statements from production build (verify dead-code elimination or manual removal)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — can be implemented independently
- **User Story 2 (Phase 4)**: Depends on US1 (needs scene + animation + input) + Foundational
- **User Story 3 (Phase 5)**: Depends on US2 (needs multiplayer data channels) + US1
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — can be built, tested, and demoed alone 🎯 MVP
- **User Story 2 (P2)**: Depends on US1 for scene rendering and avatar animation system
- **User Story 3 (P3)**: Depends on US2 for P2P data channels; depends on US1 for scene context

### Within Each User Story

- Models/entities before systems
- Systems before integration into main game loop
- Core implementation before polish

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different directories)
- T009, T010 can run in parallel (different files, no shared state)
- T013 starts foundation for US2; T018 starts foundation for US3
- T022, T023, T024, T025, T026, T027 can all run in parallel in Polish phase

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (T009–T012)
4. **STOP and VALIDATE**: Open browser, walk around planet, see NPCs
5. Deploy/demo if ready — single-player planet roam is the MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Roam) → **MVP!** Single-player planet world
3. Add US2 (Multiplayer) → Social world with other players
4. Add US3 (Chat) → Full social experience
5. Polish → Production quality

### Parallel Team Strategy

With multiple developers:
1. Developer A: US1 (SceneSystem, PlayerInput, NPCSystem)
2. Developer B: US2 (MultiplayerSystem, relay server, WebRTC)
3. Together: Integrate US1 + US2, then US3 together
