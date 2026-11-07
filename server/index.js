import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { WebSocketServer } from 'ws';
import * as protobuf from 'protobufjs';
import { randomBytes } from 'crypto';
import {
  getPort,
  getTlsOptions,
  getScheme,
  getWsUrl,
  isProduction,
} from './config/tls.js';
import { logger } from './utils/logger.js';
import { sendError, ErrorCodes } from './middleware/errors.js';
import { authenticateUpgrade, generateToken, verifyToken } from './middleware/auth.js';
import { checkLimit } from './middleware/rateLimit.js';
import {
  validateMessage,
  MAX_BINARY_PAYLOAD_BYTES,
  sanitizeString,
} from './middleware/validate.js';

const MAX_PLAYERS = 15;
const UPDATE_RATE = 1000 / 35;
const PING_RATE = 1000 / 20;
const PORT = getPort();
const GRACE_PERIOD_MS = 5000;

let RealmData = null;
protobuf.load('src/proto/realm.proto').then(root => {
  RealmData = root.lookupType('RealmData');
});

const adjectives = [
  'Brave', 'Calm', 'Swift', 'Bold', 'Clever', 'Quiet', 'Fierce', 'Gentle',
  'Happy', 'Lucky', 'Merry', 'Noble', 'Proud', 'Sharp', 'Shy', 'Silly',
  'Wise', 'Zesty', 'Cosmic', 'Solar', 'Lunar', 'Jolly', 'Keen', 'Mellow',
];
const animals = [
  'Fox', 'Wolf', 'Bear', 'Hawk', 'Deer', 'Owl', 'Badger', 'Lynx',
  'Panda', 'Raven', 'Coyote', 'Otter', 'Falcon', 'Lion', 'Tiger', 'Zebra',
  'Koala', 'Robin', 'Swan', 'Viper', 'Crane', 'Moose', 'Seal', 'Wren',
];

function generateName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return adj + animal;
}

function generateId() {
  return randomBytes(8).toString('hex');
}

class Client {
  constructor(ws) {
    this.id = generateId();
    this.ws = ws;
    this.room = null;
    this.displayName = generateName();
    this.data = {
      p: [0, 2, 0],
      r: [0, 0, 0],
      medium: 0,
      animation: 0,
      bonesFile: 'avatar/avatar-bones',
      modelFiles: JSON.stringify(['avatar/avatar']),
      animationFiles: JSON.stringify(['avatar/avatar-idle', 'avatar/avatar-walk', 'avatar/avatar-run', 'avatar/avatar-air', 'avatar/avatar-afk']),
      tag: this.displayName,
      networkEvent: '',
    };
    this.lastSeen = Date.now();
    this.requestId = logger.generateRequestId();
  }

  get displayNameProp() { return this.data.tag || this.displayName; }
}

class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Map();
  }

  add(client) {
    this.clients.set(client.id, client);
    client.room = this;
  }

  remove(id) {
    this.clients.delete(id);
  }

  get playerCount() { return this.clients.size; }

  broadcastBinary(excludeId, combinedBytes) {
    for (const [id, client] of this.clients) {
      if (id !== excludeId && client.ws.readyState === 1) {
        client.ws.send(combinedBytes);
      }
    }
  }

  sendJson(id, obj) {
    const client = this.clients.get(id);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(obj));
    }
  }

  broadcastJson(excludeId, obj) {
    const message = JSON.stringify(obj);
    for (const [id, client] of this.clients) {
      if (id !== excludeId && client.ws.readyState === 1) {
        client.ws.send(message);
      }
    }
  }
}

const rooms = new Map();

// Last-known position/rotation tracking for rejoin restoration.
// Keyed by client id; entries expire after LAST_KNOWN_TTL.
const LAST_KNOWN_TTL = 300 * 1000; // 300 seconds
const LAST_KNOWN_CLEANUP_MS = 60 * 1000; // 1 minute
const lastKnownPositions = new Map();

function saveLastKnownPosition(client) {
  if (!client.id) return;
  lastKnownPositions.set(client.id, {
    p: Array.isArray(client.data.p) ? [...client.data.p] : [0, 2, 0],
    r: Array.isArray(client.data.r) ? [...client.data.r] : [0, 0, 0, 1],
    ts: Date.now(),
  });
}

function cleanupLastKnownPositions() {
  const now = Date.now();
  for (const [id, entry] of lastKnownPositions.entries()) {
    if (now - entry.ts > LAST_KNOWN_TTL) {
      lastKnownPositions.delete(id);
    }
  }
}
setInterval(cleanupLastKnownPositions, LAST_KNOWN_CLEANUP_MS);

// Build the underlying HTTP/HTTPS server and attach the WebSocket server.
// Production (NODE_ENV=production): requires TLS_CERT_PATH + TLS_KEY_PATH → WSS.
// Dev: self-signed cert generated on first run → WSS; falls back to plain WS if cert generation fails.
const tlsOptions = isProduction() ? getTlsOptions() : getTlsOptions();
const httpServer = tlsOptions
  ? createHttpsServer(tlsOptions)
  : createHttpServer();
const wss = new WebSocketServer({ server: httpServer });

// Shutdown state
let shuttingDown = false;
let shutdownTimeout = null;

// /health endpoint — HTTP GET returns { status, uptime, clients, rooms }
httpServer.on('request', (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    let clientCount = 0;
    for (const room of rooms.values()) {
      clientCount += room.clients.size;
    }
    const body = JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      clients: clientCount,
      rooms: rooms.size,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }
  // Not found for any other path
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

httpServer.listen(PORT, () => {
  const scheme = getScheme(tlsOptions);
  logger.info(`Planetwood relay running on ${scheme}://localhost:${PORT}`);
});

function getOrCreateRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Room(name));
  return rooms.get(name);
}

function sendProtobufToClient(client, dataObj) {
  if (!RealmData) return;
  const verification = RealmData.verify(dataObj);
  if (verification) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('protobuf verify error', { requestId: client.requestId, verification });
    }
    return;
  }
  const msg = RealmData.create(dataObj);
  const bytes = RealmData.encode(msg).finish();
  const prefix = new TextEncoder().encode(client.id);
  const combined = new Uint8Array(prefix.length + bytes.length);
  combined.set(prefix, 0);
  combined.set(bytes, prefix.length);
  if (client.ws.readyState === 1) client.ws.send(combined);
}

function broadcastRealmData(room, excludeId, dataObj) {
  if (!RealmData) return;
  const verification = RealmData.verify(dataObj);
  if (verification) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('protobuf verify error', { requestId: excludeId, verification });
    }
    return;
  }
  const msg = RealmData.create(dataObj);
  const bytes = RealmData.encode(msg).finish();
  for (const [id, client] of room.clients) {
    if (id !== excludeId && client.ws.readyState === 1) {
      const prefix = new TextEncoder().encode(id);
      const combined = new Uint8Array(prefix.length + bytes.length);
      combined.set(prefix, 0);
      combined.set(bytes, prefix.length);
      client.ws.send(combined);
    }
  }
}

/**
 * Graceful shutdown: stop accepting new connections, notify all clients,
 * close sockets after grace period, then exit process.
 */
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn('Shutdown initiated', { reason: 'signal' });

  // Stop accepting new WebSocket connections.
  try {
    wss.close(() => {
      logger.info('WebSocket server stopped accepting new connections');
    });
  } catch (err) {
    logger.error('Error closing WebSocket server', { requestId: null, error: err.message });
  }

  // Notify all connected clients of impending shutdown.
  const shutdownEnvelope = JSON.stringify({
    type: 'error',
    payload: {
      code: ErrorCodes.SERVER_SHUTDOWN,
      message: 'Server is shutting down',
      timestamp: new Date().toISOString(),
    },
  });
  for (const [id, client] of wss.clients) {
    if (client.ws.readyState === 1) {
      try {
        client.ws.send(shutdownEnvelope);
      } catch {
        // Best-effort notification.
      }
    }
  }

  // After grace period, close all client sockets, close HTTP server, exit.
  shutdownTimeout = setTimeout(() => {
    logger.warn('Grace period elapsed — closing all client sockets', {
      clientCount: wss.clients.size,
    });
    for (const [id, client] of wss.clients) {
      try {
        if (client.ws.readyState === 1) {
          client.ws.close(1001, 'Server shutting down');
        }
      } catch {
        // Ignore close errors.
      }
    }
    try {
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    } catch {
      process.exit(0);
    }
    // Fallback exit if httpServer.close never completes.
    setTimeout(() => process.exit(1), 2000);
  }, GRACE_PERIOD_MS);
}

function handleSignal(signal) {
  logger.info(`Received ${signal} — beginning graceful shutdown`, { signal });
  shutdown();
}

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));

// Uncaught exception / unhandled rejection: structured logging + controlled exit.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { requestId: null, error: err.message, stack: err.stack });
  if (shutdownTimeout) clearTimeout(shutdownTimeout);
  shutdown();
  setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { requestId: null, reason: String(reason) });
});

wss.on('connection', (ws, req) => {
  if (shuttingDown) {
    sendError(ws, ErrorCodes.SERVER_SHUTDOWN, 'Server is shutting down');
    return;
  }

  if (wss.clients.size >= MAX_PLAYERS) {
    sendError(ws, ErrorCodes.SESSION_FULL, 'Session at max capacity');
    return;
  }

  // Connection rate limit per IP address.
  const clientIp = req.socket?.remoteAddress
    || (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : undefined)
    || 'unknown';
  const connectionLimit = checkLimit(clientIp, 'connection');
  if (!connectionLimit.allowed) {
    sendError(ws, ErrorCodes.RATE_LIMITED, 'Connection rate limit exceeded', {
      closeCode: 4003,
      closeReason: `Retry after ${connectionLimit.retryAfter}s`,
    });
    return;
  }

  // Authentication: require valid JWT on WebSocket upgrade.
  // Token from Authorization: Bearer <token> header or ?token=<token> query param.
  const authResult = authenticateUpgrade(req);
  if (!authResult.ok) {
    const isExpired = authResult.reason === 'AUTH_EXPIRED';
    sendError(ws, ErrorCodes.AUTH_REQUIRED, isExpired ? 'Token expired' : 'Authentication required', {
      closeCode: 4001,
    });
    return;
  }

  const client = new Client(ws);
  client.auth = authResult.auth; // { id, displayName, room, token }
  logger.setRequestId(client.requestId);
  let room = null;
  let connected = false;

  // Send client id and issued JWT token after successful authentication.
  ws.send(JSON.stringify({ id: client.id, token: client.auth.token }));
  if (process.env.NODE_ENV !== 'production') {
    logger.info('[connect]', { requestId: client.requestId, name: client.displayName, id: client.id });
  }

  ws.on('message', (raw) => {
    if (shuttingDown) {
      sendError(ws, ErrorCodes.SERVER_SHUTDOWN, 'Server is shutting down');
      return;
    }

    // Require a valid JWT for all message handling. Token may be sent with
    // the message (msg.token) or rely on the one stored on the client object
    // from the upgrade handshake.
    let messageToken = null;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed && typeof parsed === 'object' && parsed.token) {
          messageToken = parsed.token;
        }
      } catch {
        // Not JSON; fall through to client.auth token below.
      }
    }
    const tokenToVerify = messageToken || (client.auth && client.auth.token);
    if (!tokenToVerify) {
      sendError(ws, ErrorCodes.AUTH_INVALID, 'Authentication token missing', {
        closeCode: 4002,
      });
      return;
    }
    try {
      verifyToken(tokenToVerify);
    } catch {
      sendError(ws, ErrorCodes.AUTH_INVALID, 'Authentication token invalid', {
        closeCode: 4002,
      });
      return;
    }

    // Message rate limit per client ID (applies to all message types).
    const messageLimit = checkLimit(client.id, 'message');
    if (!messageLimit.allowed) {
      sendError(ws, ErrorCodes.RATE_LIMITED, 'Message rate limit exceeded', {
        requestId: client.requestId,
        closeCode: 4003,
        closeReason: `Retry after ${messageLimit.retryAfter}s`,
      });
      return;
    }

    if (typeof raw !== 'string') {
      // Binary protobuf message: [localID bytes][RealmData bytes]
      if (!client.id) return;
      // Reject oversized binary payloads before any decode/allocation.
      if (raw.byteLength > MAX_BINARY_PAYLOAD_BYTES) {
        sendError(ws, ErrorCodes.VALIDATION_ERROR, 'Binary payload exceeds maximum size', {
          requestId: client.requestId,
        });
        return;
      }
      const idBytes = new TextEncoder().encode(client.id);
      if (raw.byteLength <= idBytes.length) return;
      const payloadBytes = new Uint8Array(raw).slice(idBytes.length);
      let decoded;
      try {
        decoded = RealmData.decode(payloadBytes);
      } catch {
        return;
      }
      const keys = Object.keys(decoded);
      if (keys.length === 0) return;

      // Update client data
      Object.assign(client.data, decoded);
      client.lastSeen = Date.now();

      // Handle networkEvent (emote)
      if (decoded.networkEvent && typeof decoded.networkEvent === 'string' && decoded.networkEvent.length > 0) {
        room.broadcastJson(client.id, {
          data: {
            sender: client.id,
            senderName: client.displayNameProp,
            text: '',
            emote: decoded.networkEvent,
            timestamp: Date.now(),
          },
        });
      }

      // Broadcast updated RealmData to other clients in room
      if (room) {
        broadcastRealmData(room, client.id, client.data);
      }
      return;
    }

    // JSON control messages
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendError(ws, ErrorCodes.PROTOCOL_ERROR, 'Invalid JSON message', { requestId: client.requestId });
      return;
    }

    // Validate the parsed control message against its schema before processing.
    const validation = validateMessage(msg);
    if (!validation.valid) {
      sendError(ws, ErrorCodes.VALIDATION_ERROR, 'Invalid message schema', {
        requestId: client.requestId,
        message: validation.errors.join('; '),
      });
      return;
    }

    // Sanitize all string fields before use.
    msg = sanitizeObject(msg);

    if (msg.r && Array.isArray(msg.r) && !connected) {
      // Join room: {r: [prefix, roomName]}
      const [prefix, roomName] = msg.r;
      const roomNameStr = `${prefix}/${roomName}`;
      room = getOrCreateRoom(roomNameStr);
      room.add(client);
      connected = true;
      client.lastSeen = Date.now();

      // Restore last-known position/rotation if this client rejoins with a
      // previously-seen id (within TTL).
      let restorePos = null;
      let restoreRot = null;
      const rejoinId = msg.rejoinId;
      if (rejoinId && typeof rejoinId === 'string') {
        const entry = lastKnownPositions.get(rejoinId);
        if (entry && Date.now() - entry.ts <= LAST_KNOWN_TTL) {
          restorePos = entry.p;
          restoreRot = entry.r;
        }
      }

      ws.send(JSON.stringify({ r: room.id, restorePos, restoreRot }));
      if (process.env.NODE_ENV !== 'production') {
        logger.info('[join]', { requestId: client.requestId, name: client.displayName, id: client.id, room: room.id });
      }

      // Notify existing clients about new client
      room.broadcastJson(client.id, {
        data: {
          sender: client.id,
          senderName: client.displayNameProp,
          text: '',
          event: 'join',
          timestamp: Date.now(),
        },
      });

      // Send current room state to new client
      for (const [otherId, otherClient] of room.clients) {
        if (otherId !== client.id) {
          sendProtobufToClient(client, otherClient.data);
        }
      }
      return;
    }

    if (!connected || !room) return;

    if (msg.ping && typeof msg.ping === 'number') {
      // PING -> PONG
      const now = Date.now();
      ws.send(JSON.stringify({ PONG: msg.ping, t: now }));
      client.lastSeen = now;
      return;
    }

    if (msg.leave && typeof msg.leave === 'string') {
      ws.close();
      return;
    }

    if (msg.data) {
      // Chat message broadcast — stricter chat rate limit per client.
      const chatLimit = checkLimit(client.id, 'chat');
      if (!chatLimit.allowed) {
        sendError(ws, ErrorCodes.RATE_LIMITED, 'Chat rate limit exceeded', {
          requestId: client.requestId,
          closeCode: 4003,
          closeReason: `Retry after ${chatLimit.retryAfter}s`,
        });
        return;
      }
      room.broadcastJson(client.id, {
        data: {
          sender: client.id,
          senderName: client.displayNameProp,
          text: msg.data.text || '',
          timestamp: msg.data.timestamp || Date.now(),
        },
      });
    }

    if (msg.type === 'signal' && msg.payload) {
      // Forward WebRTC signaling data to target peer
      const { to, data } = msg.payload;
      const target = room.clients.get(to);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'signal',
          payload: { from: client.id, data },
        }));
      }
      return;
    }

    if (msg.type === 'peer_joined') {
      // Notify room that a new peer is ready for P2P signaling
      room.broadcastJson(client.id, {
        type: 'peer_joined',
        payload: {
          id: client.id,
          displayName: client.displayNameProp,
          position: client.data.p || [0, 2, 0],
        },
      });
      return;
    }

    if (msg.type === 'peer_left') {
      room.broadcastJson(client.id, {
        type: 'peer_left',
        payload: { id: client.id },
      });
      return;
    }
  });

  ws.on('close', () => {
    saveLastKnownPosition(client);
    logger.clearRequestId();
    if (room) {
      if (process.env.NODE_ENV !== 'production') {
        logger.info('[leave]', { requestId: client.requestId, name: client.displayName, id: client.id, room: room.id });
      }
      room.remove(client.id);
      room.broadcastJson(client.id, {
        data: {
          sender: client.id,
          senderName: client.displayNameProp,
          text: '',
          event: 'leave',
          timestamp: Date.now(),
        },
      });
      if (room.playerCount === 0) {
        rooms.delete(room.id);
      }
    }
  });

  ws.on('error', (err) => {
    saveLastKnownPosition(client);
    logger.error('WebSocket error', { requestId: client.requestId, error: err.message });
    if (room) room.remove(client.id);
  });
});

// Periodic ping to all clients
setInterval(() => {
  if (shuttingDown) return;
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const [id, client] of room.clients) {
      if (client.ws.readyState === 1) {
        client.ws.send(JSON.stringify({ ping: now }));
      }
    }
  }
}, PING_RATE);

// Cleanup stale clients
setInterval(() => {
  if (shuttingDown) return;
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const [id, client] of room.clients) {
      if (now - client.lastSeen > 3000) {
        client.ws.close();
      }
    }
  }
}, 5000);
