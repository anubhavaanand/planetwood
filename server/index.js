import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';

const PORT = 3001;
const MAX_PLAYERS = 10;
const SESSION_GRACE_PERIOD = 30_000;

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

class Session {
  constructor() {
    this.players = new Map();
    this.timeout = null;
  }

  get playerCount() { return this.players.size; }

  addPlayer(ws) {
    const id = generateId();
    let name = generateName();
    let suffix = 0;
    while ([...this.players.values()].some(p => p.displayName === name)) {
      suffix++;
      name = generateName() + suffix;
    }
    const player = { id, displayName: name, ws, position: [0, 2, 0] };
    this.players.set(id, player);
    this._cancelTimeout();
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.players.size === 0) {
      this.timeout = setTimeout(() => this._destroy(), SESSION_GRACE_PERIOD);
    }
  }

  getPeers(excludeId) {
    return [...this.players.values()]
      .filter(p => p.id !== excludeId)
      .map(p => ({ id: p.id, displayName: p.displayName, position: p.position }));
  }

  broadcast(type, payload, excludeId) {
    const message = JSON.stringify({ type, payload });
    for (const [pid, player] of this.players) {
      if (pid !== excludeId && player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  sendTo(pid, type, payload) {
    const player = this.players.get(pid);
    if (player && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify({ type, payload }));
    }
  }

  _cancelTimeout() {
    if (this.timeout) { clearTimeout(this.timeout); this.timeout = null; }
  }

  _destroy() {
    for (const player of this.players.values()) {
      player.ws.close();
    }
    this.players.clear();
  }
}

const session = new Session();
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  if (session.playerCount >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', payload: { code: 'SESSION_FULL', message: 'Session at max capacity' } }));
    ws.close();
    return;
  }

  const player = session.addPlayer(ws);
  console.log(`[join] ${player.displayName} (${player.id})`);

  ws.send(JSON.stringify({
    type: 'joined',
    payload: {
      sessionId: 'planetwood-001',
      assignedId: player.id,
      peers: session.getPeers(player.id),
    },
  }));

  session.broadcast('peer_joined', {
    id: player.id,
    displayName: player.displayName,
    position: player.position,
  }, player.id);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', payload: { code: 'INVALID_MESSAGE', message: 'Malformed message' } }));
      return;
    }

    switch (msg.type) {
      case 'signal': {
        const target = msg.payload?.to;
        if (!target || !session.players.has(target)) {
          ws.send(JSON.stringify({ type: 'error', payload: { code: 'PEER_NOT_FOUND', message: 'Target peer not found' } }));
          return;
        }
        session.sendTo(target, 'signal', { from: player.id, data: msg.payload.data });
        break;
      }
      case 'state': {
        if (msg.payload?.position) player.position = msg.payload.position;
        break;
      }
      case 'leave': {
        ws.close();
        break;
      }
      default: {
        ws.send(JSON.stringify({ type: 'error', payload: { code: 'INVALID_MESSAGE', message: `Unknown type: ${msg.type}` } }));
      }
    }
  });

  ws.on('close', () => {
    console.log(`[leave] ${player.displayName} (${player.id})`);
    session.removePlayer(player.id);
    session.broadcast('peer_left', { id: player.id }, player.id);
  });
});

console.log(`Planetwood relay running on ws://localhost:${PORT}`);
