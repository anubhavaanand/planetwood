# Data Model: Multiplayer Planet World

## PlayerAvatar

Represents a connected player in the world.

```text
PlayerAvatar {
  id: string              // Unique session ID (assigned by relay)
  displayName: string     // Adjective-animal name, e.g. "BraveFox"
  npcType: string         // Which NPC appearance they have (random on join)
  position: Vec3          // Current world position
  rotation: Quaternion    // Current facing direction
  animationState: string  // Current animation: "idle" | "walk" | "run" | "sprint" | "air"
  scale: Vec3             // Bone scale from decoded data
  isConnected: boolean
  lastSeenAt: timestamp   // For disconnection detection
}
```

**State transitions**:
- `connecting` → `spawning` (on successful relay handshake)
- `spawning` → `roaming` (initial position received from relay)
- `roaming` → `disconnected` (relay signals disconnect or timeout after 10s)
- `roaming` stays `roaming` throughout normal gameplay

## NPC

A pre-placed non-player character on the planet.

```text
NPC {
  id: string              // Unique NPC identifier
  npcType: string         // Type: "alien", "boss", "caveman", etc.
  displayName: string     // Friendly name shown above NPC
  position: Vec3          // Fixed world position (from scene glTF)
  rotation: Quaternion    // Facing direction at placement
  animationClips: string[] // Available animation names for this type
  activeClip: string       // Currently playing clip (default: idle)
  scale: Vec3              // Bone scale from decoded data
}
```

NPCs do not move from their positions in v1. They loop their idle animation
indefinitely. Some NPCs have additional animations (talk, walk) that could be
triggered by future events.

## ChatMessage

A text message sent between nearby players.

```text
ChatMessage {
  senderId: string        // PlayerAvatar.id
  senderName: string      // PlayerAvatar.displayName
  text: string            // Message content
  timestamp: number       // Unix ms
  position: Vec3          // Sender's position at time of send
  proximityRadius: number // Configurable range (default: 20 units)
}
```

Visible only to recipients within `proximityRadius` of `position`.
Rate-limited: max 1 message per 2 seconds per sender (client-enforced).

## MultiplayerSession

The shared world instance state, maintained by the WebSocket relay.

```text
MultiplayerSession {
  sessionId: string       // Unique session identifier
  players: Map<string, PlayerAvatar>  // Connected players
  createdAt: timestamp
  maxPlayers: number      // Default: 10
}
```

The relay keeps the session alive as long as at least one player is connected.
When the last player disconnects, the session is destroyed after a 30s grace period.

## Signaling Protocol Messages

### Client → Relay (WebSocket)

| Message | Payload | Description |
|---------|---------|-------------|
| `join` | `{}` | Request to join the session |
| `signal` | `{ to: peerId, data: any }` | Forward WebRTC signaling data to peer |
| `leave` | `{}` | Notify relay of intentional disconnect |

### Relay → Client (WebSocket)

| Message | Payload | Description |
|---------|---------|-------------|
| `joined` | `{ sessionId, assignedId, peers: [...] }` | Join confirmed with existing peers |
| `peer_joined` | `{ id, displayName, position }` | New player connected |
| `peer_left` | `{ id }` | Player disconnected |
| `signal` | `{ from: peerId, data: any }` | WebRTC signaling data from peer |
| `error` | `{ code, message }` | Error notification |

### Client ↔ Client (WebRTC Data Channel)

| Message | Payload | Description |
|---------|---------|-------------|
| `state` | `{ position, rotation, animationState }` | Player state update (~12 Hz) |
| `chat` | `{ text, timestamp }` | Chat message |
| `emote` | `{ type: string }` | Emote trigger (e.g., "wave") |

## Animation Data Structure

Each entry in `decoded_animations.json`:

```text
{
  "attributes": {
    "position": { "array": Float32Array, "itemSize": 3 },
    "quaternion": { "array": Float32Array, "itemSize": 4 },
    "scale": { "array": Float32Array, "itemSize": 3 },
    // Bone files also have:
    "hierarchy": { "array": Int32Array, "itemSize": 1 }
  },
  "vertices": number,      // Total per-frame datapoints
  "info": {                 // Present in animation files
    "userData": {
      "frames": number,
      "fps": number
    }
  }
}
```

- **Bone files**: `vertices` = number of bones. Single-frame rest pose data.
- **Animation files**: `vertices = frames * numBones`. Per-frame animation data.
- **Hierarchy**: 1-based parent index. 0 = root bone. Used to build bone tree.
