# Feature Specification: Multiplayer Planet World

**Feature Branch**: `001-multiplayer-planet-world`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "A 3D planet scene where players can roam and meet each other, multiplayer, visually like messenger.abeto, a playable and explorable experience as a spiritual successor to messenger.abeto"

## Clarifications

### Session 2026-06-27

- Q: Who hosts the WebSocket signaling relay for multiplayer peer discovery? → A: Local Node.js relay server bundled in the project.
- Q: What format and uniqueness rules for player display names? → A: Random adjective-animal names (e.g., "BraveFox", "CalmOwl"), assigned on join, guaranteed unique by relay.
- Q: What level of observability/logging for development and debugging? → A: Console logging during development (networking events, errors, connection state changes), stripped from production build via dead-code elimination.
- Q: Chat rate limiting to prevent message spam? → A: Client-side rate limit of 1 message per 2 seconds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Roam the Planet (Priority: P1)

A player opens Planetwood in their browser and immediately lands on a beautiful 3D planet. They can walk around freely using keyboard controls, explore the terrain, and see NPCs going about their idle routines. The planet feels alive with ambient details like grass, butterflies, and trees.

**Why this priority**: P1 delivers the core playable experience — a world worth exploring. Without this, there is no game. Every other feature builds on top of this foundation.

**Independent Test**: Load the page, verify the 3D planet renders with all environment elements visible. Use WASD to walk around the planet surface. Observe at least one NPC playing its idle animation.

**Acceptance Scenarios**:

1. **Given** the player opens Planetwood in a browser, **When** the page loads, **Then** the 3D planet scene renders within 5 seconds with terrain, sky, and ambient elements visible.
2. **Given** the 3D planet is loaded, **When** the player presses W/A/S/D keys, **Then** the avatar moves at 5 units/second with quaternion interpolation across the planet surface in the corresponding direction.
3. **Given** the player is exploring the planet, **When** they approach an NPC, **Then** the NPC plays its idle animation (e.g., swaying, shifting weight) at its designated position.
4. **Given** the planet is rendered, **When** the player rotates the camera, **Then** the view follows with 0.8 damping factor, clamped to 0–80° polar angle, with no clipping through the terrain.

---

### User Story 2 - Meet Other Players (Priority: P2)

Multiple players can be in the same planet world at the same time. Each player sees others as animated avatars roaming around in real-time. Players can wave or emote to get each other's attention.

**Why this priority**: Multiplayer is the defining feature of Planetwood. Seeing another real person on the planet transforms it from a demo into a social experience.

**Independent Test**: Open Planetwood in two browser windows side-by-side. Verify both players appear in the same world and can see each other's movement in real-time (under 500ms latency).

**Acceptance Scenarios**:

1. **Given** two players have loaded the same planet world, **When** Player A moves to a new position, **Then** Player B sees Player A's avatar at that position within 500ms.
2. **Given** two players are in the same world, **When** one player disconnects, **Then** their avatar disappears from the other player's view within 3 seconds.
3. **Given** a player joins a world with 5 other players already present, **When** they fully load in, **Then** they see all 5 existing player avatars in their correct positions.

---

### User Story 3 - Chat with Nearby Players (Priority: P3)

Players can send and receive text messages that appear above their avatar. Chat is proximity-based: only players within a certain radius see each other's messages. A small chat log shows recent messages.

**Why this priority**: Chat makes the world social. Proximity-based chat preserves the spatial feel and prevents global message spam.

**Independent Test**: Open three browser windows. Position two avatars close together and one far away. Send a message from one close player and verify only the other close player sees it, not the distant one.

**Acceptance Scenarios**:

1. **Given** two players are within chat range of each other, **When** Player A types a message and presses Enter, **Then** the message appears as a bubble above Player A's avatar and in the chat log of both players within 500ms.
2. **Given** a player is outside chat range of another player, **When** the distant player sends a message, **Then** it does NOT appear in the out-of-range player's view.
3. **Given** a player wants to chat, **When** they press the Enter key, **Then** a chat input field opens, the user types, and pressing Enter again sends the message.

---

### User Story 4 - Events & Advertisements (Priority: P4 - Future)

The planet hosts special events (seasonal decorations, mini-games, NPC-led activities) and displays non-intrusive advertisement placements (virtual billboards, sponsored items) that blend into the world aesthetic.

**Why this priority**: Events drive re-engagement and ads provide a monetization path. Deferred to P4 because the core world and social features must come first.

**Independent Test**: Activate a scheduled event (e.g., Halloween decor toggle) and verify the planet updates with event-specific visual elements. Toggle an ad placement and verify it renders without breaking the scene.

**Acceptance Scenarios**:

1. **Given** a seasonal event is active, **When** a player enters the world, **Then** event-specific decorations and NPC behaviors are visible.
2. **Given** an advertisement placement exists on the planet, **When** a player walks near it, **Then** the ad renders without blocking movement or causing performance drops below 30fps.

### Edge Cases

- Player loads the page but WebRTC/signaling fails — fall back to single-player mode gracefully with a notification.
- Two players choose the same avatar appearance — system assigns unique name tags or color tints.
- Browser tab is backgrounded — player avatar should enter an "away" idle state after 30 seconds.
- Player rejoins the same world after disconnect — avatar position restored to last known location.
- Chat contains offensive content — system provides a client-side option to filter or report (no automated moderation in v1).
- Player sends messages faster than 1 per 2 seconds — client-side rate limit suppresses excess messages with no error to the sender.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load and render the full 3D planet scene (terrain, sky, ambient elements, NPCs) from the glTF asset within 5 seconds on a mid-range device.
- **FR-002**: System MUST provide keyboard-only controls (WASD + arrow keys) for player movement around the planet surface.
- **FR-003**: System MUST play NPC idle animations at each NPC's designated position using the decoded animation data.
- **FR-004**: System MUST connect players to a shared multiplayer session using WebRTC-based P2P with a local Node.js WebSocket relay server for peer discovery and signaling.
- **FR-005**: System MUST synchronize player positions across all clients in real-time (target: under 500ms latency).
- **FR-006**: System MUST display other players as animated avatars using the same skin/animation system as NPCs.
- **FR-007**: System MUST provide proximity-based text chat visible only to players within a configurable radius.
- **FR-008**: System MUST handle player disconnection gracefully: remove avatar within 3 seconds, allow rejoin.
- **FR-009**: System MUST support keyboard navigation for all UI elements (tab order, focus indicators, Enter to activate).
- **FR-010**: System MUST provide screen reader announcements for key events (player joined, message received, connection status).
- **FR-011**: System MUST fall back to single-player mode if multiplayer signaling fails, with a notification to the player.
- **FR-012**: System MUST render at minimum 30fps (target 60fps) on mid-range hardware (integrated GPU) with all NPCs and 10+ players.
- **FR-013**: System MUST log networking events (connection, disconnection, sync errors) to the browser console during development builds, with logging stripped from production builds.
- **FR-014**: System MUST provide an emote system allowing players to trigger gesture animations (e.g., wave) visible to nearby players, sent via WebRTC data channel.

### Key Entities

- **Player Avatar**: The in-world representation of a connected user. Has a character model, position, rotation, animation state, and a display name. Associated with a single player session.
- **NPC (Non-Player Character)**: A pre-placed character on the planet with a defined NPC type (e.g., alien, chef, diver), idle animation(s), and a fixed position. Does not move from its spot in v1.
- **Planet Scene**: The static 3D environment including terrain mesh, sky, buildings, trees, grass, butterflies, and ambient lighting. Loaded from the glTF export.
- **Chat Message**: A text message with sender name, timestamp, and position context. Only visible to players within proximity radius.
- **Multiplayer Session**: A shared instance of the planet world that players can join. Managed via local Node.js WebSocket relay for peer discovery with P2P WebRTC for real-time state sync. Contains the set of connected players and their synchronized state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can load the planet scene and begin moving within 5 seconds on a mid-range browser (Chrome, Firefox, Edge).
- **SC-002**: Players see NPCs with idle animations playing at 24+ fps on integrated GPU hardware.
- **SC-003**: Two players in the same world see each other's position updates within 500ms (measured from input to display on peer).
- **SC-004**: Players can send a chat message and have it appear to nearby players within 500ms.
- **SC-005**: Screen reader announces "Player joined" and "Message received" events within 1 second of occurrence.
- **SC-006**: Up to 10 simultaneous players experience stable 30fps+ rendering without client-side crashes.

## Assumptions

- Players open Planetwood via a direct URL to a shared world instance — no account or login required in v1.
- Multiplayer uses a local Node.js WebSocket relay server (bundled in the project, started alongside the Vite dev server via `npm run dev:server`) for initial peer discovery, then P2P WebRTC for real-time sync. Production deployment would use a persistent relay host.
- The decoded animation JSON (21MB) is loaded at startup; future optimization may stream or split it.
- NPCs are static in position with looping idle animations — no NPC pathfinding or interaction in v1.
- Chat is unmoderated text with a client-side report/block option; no server-side content filtering.
- Players are assigned a random avatar appearance and a random adjective-animal display name (e.g., "BraveFox") on join, guaranteed unique by the relay server (no authentication).
- The planet scene glTF is already exported and placed in `public/` (scene.gltf + scene.bin + decoded_animations.json).
- Mid-range hardware means an Intel UHD Graphics 620 or equivalent, 8GB RAM, modern browser.
