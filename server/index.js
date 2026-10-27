import { WebSocketServer } from 'ws';
import * as protobuf from 'protobufjs';
import { randomBytes } from 'crypto';

const PORT = 3005;
const MAX_PLAYERS = 15;
const UPDATE_RATE = 1000 / 35;
const PING_RATE = 1000 / 20;

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
const wss = new WebSocketServer({ port: PORT });

function getOrCreateRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Room(name));
  return rooms.get(name);
}

function sendProtobufToClient(client, dataObj) {
  if (!RealmData) return;
  const verification = RealmData.verify(dataObj);
  if (verification) {
    console.warn('protobuf verify error', verification);
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
    console.warn('protobuf verify error', verification);
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

wss.on('connection', (ws) => {
  if (wss.clients.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', payload: { code: 'SESSION_FULL', message: 'Session at max capacity' } }));
    ws.close();
    return;
  }

  const client = new Client(ws);
  let room = null;
  let connected = false;

  ws.send(JSON.stringify({ id: client.id }));
  console.log(`[connect] ${client.displayName} (${client.id})`);

  ws.on('message', (raw) => {
    if (typeof raw !== 'string') {
      // Binary protobuf message: [localID bytes][RealmData bytes]
      if (!client.id) return;
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
      return;
    }

    if (msg.r && Array.isArray(msg.r) && !connected) {
      // Join room: {r: [prefix, roomName]}
      const [prefix, roomName] = msg.r;
      const roomNameStr = `${prefix}/${roomName}`;
      room = getOrCreateRoom(roomNameStr);
      room.add(client);
      connected = true;
      client.lastSeen = Date.now();
      ws.send(JSON.stringify({ r: room.id }));
      console.log(`[join] ${client.displayName} (${client.id}) -> ${room.id}`);

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
      // Chat message broadcast
      room.broadcastJson(client.id, {
        data: {
          sender: client.id,
          senderName: client.displayNameProp,
          text: msg.data.text || '',
          timestamp: msg.data.timestamp || Date.now(),
        },
      });
    }
  });

  ws.on('close', () => {
    if (room) {
      console.log(`[leave] ${client.displayName} (${client.id}) from ${room.id}`);
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

  ws.on('error', () => {
    if (room) room.remove(client.id);
  });
});

// Periodic ping to all clients
setInterval(() => {
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
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const [id, client] of room.clients) {
      if (now - client.lastSeen > 10000) {
        client.ws.close();
      }
    }
  }
}, 5000);

console.log(`Planetwood relay running on ws://localhost:${PORT}`);
