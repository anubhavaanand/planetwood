## File: server/index.js:649

### Trigger
Server cleanup interval (line 644) runs every 5 seconds and closes client connections where `now - client.lastSeen > 3000` (3 seconds).

### Impact
Client-side `MultiplayerSystem.js` (line 746) also checks peer timeouts: `now - (avatar.lastSeenAt || 0) > 3000`. This creates a **race condition**:

1. Server hasn't received message from Client A for 2900ms
2. Client B sees Client A's `lastSeenAt` as 2900ms ago → considers A alive
3. Server cleanup runs at 3000ms mark → closes Client A's socket
4. Client B doesn't know until next update cycle → **desync window of ~3s**

Worse: if server is under load and cleanup runs late (e.g., 4000ms), Client B may have already removed the peer locally while server still has it.

### Root Cause
Both client and server independently enforce 3s timeout with no coordination.

### Suggested Fix
Option A: Server-only authority — server broadcasts "peer left" immediately on timeout, client only reacts to that event.

Option B: Increase server timeout to 5s (client keeps 3s) so client removes first, server cleans up after.

Option C: Use WebSocket ping/pong (already exists at line 637) as liveness — only close on ping failure, not message silence.

### Verdict
**Confirmed Blocker** — desync race condition between client and server timeout logic.