# Signaling Protocol Contract

## Transport

- **WebSocket** (relay): `ws://localhost:3001` (dev) for peer discovery and signaling
- **WebRTC DataChannel** (P2P): for real-time state sync and chat

## Connection Flow

```
Client A              Relay               Client B
   |                     |                     |
   |--- WS: join ------>|                     |
   |<-- WS: joined -----|                     |
   |                     |-- WS: peer_joined ->| (if B already present)
   |                     |                     |
   |--- WS: signal{B}-->|-- WS: signal{A}---->|
   |<-- WS: signal{B}---|                     |
   |                     |                     |
   |<--- P2P DataChannel Established --------->|
   |                     |                     |
   |--- DC: state ----->|                     |
   |                     |<--- DC: state ------|
```

## WebSocket Messages

All messages are JSON with `type` and optional `payload`.

### Client → Relay

```typescript
// Join session
{ type: "join" }

// Forward WebRTC signaling data to peer
{ type: "signal", payload: { to: "<peerId>", data: <any> } }

// Leave session intentionally
{ type: "leave" }
```

### Relay → Client

```typescript
// Join confirmed
{
  type: "joined",
  payload: {
    sessionId: "<uuid>",
    assignedId: "<playerId>",
    peers: [
      { id: "<peerId>", displayName: "<name>", position: [x, y, z] }
    ]
  }
}

// New peer connected
{
  type: "peer_joined",
  payload: {
    id: "<peerId>",
    displayName: "<name>",
    position: [x, y, z]
  }
}

// Peer disconnected
{ type: "peer_left", payload: { id: "<peerId>" } }

// WebRTC signaling data from peer
{ type: "signal", payload: { from: "<peerId>", data: <any> } }

// Error
{ type: "error", payload: { code: "<code>", message: "<msg>" } }
```

## WebRTC DataChannel Messages

Exchanged directly between peers over the DataChannel.

```typescript
// Player state sync (~12 Hz)
{ type: "state", position: [x, y, z], rotation: [x, y, z, w], animation: "<state>" }

// Chat message (sent to all nearby peers)
{ type: "chat", text: "<message>", timestamp: <unix_ms> }

// Emote
{ type: "emote", emote: "<type>" }
```

## Error Codes

| Code | Description |
|------|-------------|
| `SESSION_FULL` | Session at max capacity |
| `INVALID_MESSAGE` | Malformed message |
| `PEER_NOT_FOUND` | Target peer no longer connected |

## Deployment Notes

- Dev: relay runs at `ws://localhost:3001`, started via `node server/index.js`
- Production: relay deployed to persistent host (e.g., Fly.io, Railway), URL configured via env var
