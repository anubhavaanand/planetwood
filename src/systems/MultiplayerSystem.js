import * as protobuf from 'protobufjs';
import * as THREE from 'three';
import { PlayerAvatar } from '../entities/PlayerAvatar.js';

const SYNC_INTERVAL = 1000 / 35;
const PING_RATE = 1000 / 20;
const CLIENTS_LIMIT = 15;
const ROOM_PREFIX = 'default';
const RECONNECT_DELAY = 1000;

let protoRoot = null;
let RealmData = null;

async function loadRealmData() {
  if (RealmData) return RealmData;
  protoRoot = await protobuf.load('src/proto/realm.proto');
  RealmData = protoRoot.lookupType('RealmData');
  return RealmData;
}

export class MultiplayerSystem {
  constructor(url = 'ws://localhost:3005', scene, animSys, animData, meshLoader) {
    this.url = url;
    this.servers = [url];
    this.scene = scene;
    this.animSys = animSys;
    this.animData = animData;
    this.meshLoader = meshLoader;

    this.connected = false;
    this.serverIndex = 0;
    this.serverFirstConnection = true;
    this.serverPing = 20;
    this.serverTimeDiff = 0;

    this.roomPrefix = ROOM_PREFIX;
    this.roomRequested = '';
    this.clients = new Map();
    this.clientsLimit = CLIENTS_LIMIT;
    this.localID = null;
    this.localIDLength = 0;

    this._protoMsg = null;
    this._protoMsgFields = 0;

    this._updateRate = SYNC_INTERVAL;
    this._pingRate = PING_RATE;
    this._data = {
      p: [0, 2, 0],
      r: [0, 0, 0],
      medium: 0,
      animation: 0,
      bonesFile: 'avatar/avatar-bones',
      modelFiles: ['avatar/avatar'],
      animationFiles: ['avatar/avatar-idle', 'avatar/avatar-walk', 'avatar/avatar-run', 'avatar/avatar-air', 'avatar/avatar-afk'],
      tag: '',
      networkEvent: '',
    };
    this._prevData = JSON.stringify(this._data);

    this._updateInterval = null;
    this._pingInterval = null;
    this._relayInterval = null;
    this._retryInterval = null;

    this.socket = null;
    this.socketCreated = false;
    this._boundOpen = this._open.bind(this);
    this._boundMessage = this._message.bind(this);
    this._boundClose = this._close.bind(this);
    this._boundPing = this._ping.bind(this);
    this._boundRelay = this._relay.bind(this);

    this.players = new Map();
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onChatMessage = null;
    this.onEmote = null;
    this.onNotification = null;

    loadRealmData().then(msg => {
      this._protoMsg = msg;
      this._protoMsgFields = Object.keys(msg.fields).length;
    });
  }

  connect() {
    this._createSocket();
  }

  _createSocket() {
    this.socket = new WebSocket(this.servers[this.serverIndex], 'permessage-deflate');
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = this._boundOpen;
    this.socket.onmessage = this._boundMessage;
    this.socket.onerror = this._boundClose;
    this.socket.onclose = this._boundClose;
    this.socketCreated = true;
  }

  _forceConnectionState(state) {
    this._close(false);
    if (this.socketCreated && state) this._createSocket();
  }

  _open() {
    this.serverFirstConnection = false;
    this.connected = true;
    this._onConnect();
  }

  _close(force = true) {
    if (this.socketCreated) {
      ['onopen', 'onmessage', 'onclose', 'onerror'].forEach(k => { this.socket[k] = null; });
      clearInterval(this._pingInterval);
      clearInterval(this._relayInterval);
      clearInterval(this._retryInterval);
      this.socket.close();
    }
    if (this.connected) {
      this.connected = false;
      this._onDisconnect();
      if (this.onNotification) this.onNotification('Multiplayer disconnected');
    }
    if (force !== false) {
      if (this.serverFirstConnection) {
        this.serverIndex = (this.serverIndex + 1) % this.servers.length;
        this._retryInterval = setInterval(() => {
          clearInterval(this._retryInterval);
          this._createSocket();
        }, RECONNECT_DELAY);
      } else {
        this._retryInterval = setInterval(() => {
          if (Object.keys(this._retrieveChangedData()).length > 0) {
            clearInterval(this._retryInterval);
            this._createSocket();
          }
        }, RECONNECT_DELAY);
      }
    }
  }

  _onConnect() {
    if (this.onNotification) this.onNotification('Multiplayer connected');
  }

  _onDisconnect() {
    if (this.onNotification) this.onNotification('Multiplayer disconnected');
  }

  _message(event) {
    try {
      if (typeof event.data !== 'string') {
        const decoder = new TextDecoder();
        const localIdStr = decoder.decode(event.data.slice(0, this.localIDLength));
        const msg = RealmData.decode(new Uint8Array(event.data.slice(this.localIDLength)));
        const keys = Object.keys(msg);
        const client = this.clients.get(localIdStr);
        if (client) {
          keys.forEach(k => {
            if (msg[k] instanceof Array && msg[k].length === 0) return;
            client[k] = msg[k];
          });
        } else {
          if (this.clients.size >= this.clientsLimit ||
              keys.reduce((h, d) => (msg[d] instanceof Array && msg[d].length === 0 ? h : h + 1), 0) !== this._protoMsgFields) {
            return;
          }
          this.clients.set(localIdStr, msg);
          this._addClient(localIdStr, msg);
        }
        return;
      }

      const json = JSON.parse(event.data);
      if (json.PONG && typeof json.PONG === 'number') {
        const now = Date.now();
        this.serverPing = Math.max(0, (now - json.PONG) * 0.5);
        this.serverTimeDiff = now - (json.t || now) - this.serverPing;
      } else if (json.id && typeof json.id === 'string') {
        this.localID = json.id;
        this.localIDLength = this.localID.length;
        this._requestRoom(this.roomRequested);
      } else if (json.r && typeof json.r === 'string') {
        this.clients.clear();
        this.roomRequested = json.r;
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._boundPing, this._pingRate * 1000);
        clearInterval(this._relayInterval);
        this._relayInterval = setInterval(this._boundRelay, this._updateRate);
        this._ping();
        this._relay(true);
        this._onRoomJoined(this.roomRequested);
      } else if (json.data) {
        if (this.onChatMessage) this.onChatMessage(json.data);
      } else if (json.leave && typeof json.leave === 'string') {
        if (!this.clients.has(json.leave)) return;
        this.clients.delete(json.leave);
        this._removeClient(json.leave);
      }
    } catch {}
  }

  _onRoomJoined(room) {
    if (this.onNotification) this.onNotification(`Joined room: ${room}`);
  }

  _ping() {
    this._sendJson({ ping: Date.now() });
  }

  _requestRoom(room = '') {
    this.roomRequested = room;
    this._sendJson({ r: [this.roomPrefix, this.roomRequested] });
  }

  _retrieveChangedData() {
    const prev = JSON.parse(this._prevData);
    const changed = {};
    Object.keys(this._data).forEach(k => {
      if (JSON.stringify(prev[k]) !== JSON.stringify(this._data[k])) changed[k] = this._data[k];
    });
    return changed;
  }

  _relay(force = false) {
    if (force) {
      this._prevData = JSON.stringify(this._data);
      this._sendRelayedData(JSON.parse(this._prevData));
    } else {
      const changed = this._retrieveChangedData();
      if (Object.keys(changed).length === 0) return;
      this._prevData = JSON.stringify(this._data);
      this._sendRelayedData(changed);
    }
  }

  _sendJson(obj) {
    if (!this.connected) return;
    this.socket.send(JSON.stringify(obj));
  }

  _sendRelayedData(obj) {
    if (!this.connected) return;
    const verification = RealmData.verify(obj);
    if (verification) {
      console.warn('websocket data error', verification);
      return;
    }
    const msg = RealmData.create(obj);
    const bytes = RealmData.encode(msg).finish();
    const prefix = this.localID ? new TextEncoder().encode(this.localID) : new Uint8Array(0);
    const combined = new Uint8Array(prefix.length + bytes.length);
    combined.set(prefix, 0);
    combined.set(bytes, prefix.length);
    this.socket.send(combined);
  }

  _addClient(id, data) {
    if (this.players.has(id)) return;
    const position = data.p && data.p.length === 3 ? new THREE.Vector3().fromArray(data.p) : new THREE.Vector3(0, 2, 0);
    const rotation = data.r && data.r.length === 3 ? new THREE.Euler().fromArray(data.r) : new THREE.Euler();

    let hash = 0;
    const name = data.tag || '';
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const color = new THREE.Color().setHSL(hue / 360, 0.75, 0.55);

    const skinEntry = this.animSys.findAvatarBones(this.animData);
    const avatar = new PlayerAvatar({
      id,
      displayName: data.tag || 'Player',
      position,
    });

    this.scene.add(avatar.group);
    this.players.set(id, avatar);

    if (skinEntry) {
      const { bones, skeleton } = this.animSys.createSkin(skinEntry);
      const mat = new THREE.MeshStandardMaterial({ color, skinning: true, roughness: 0.6, metalness: 0.1 });

      const setupAnimations = () => {
        const animNames = ['idle', 'walk', 'run', 'afk1', 'afk2', 'afk3'];
        for (const name of animNames) {
          const entry = this.animSys.findAvatarAnim(this.animData, name);
          if (entry && avatar.skeleton) {
            const { clip } = this.animSys.createSkinAnimation(entry, avatar.skeleton);
            let animName = name;
            if (name === 'afk1') animName = 'wave';
            if (name === 'afk2') animName = 'stretch';
            if (name === 'afk3') animName = 'look';
            avatar.addAnimation(animName, clip);
          }
        }
        avatar.playAnimation('idle');
      };

      if (this.meshLoader) {
        const glbUrl = `./assets/avatar/avatar.glb`;
        this.meshLoader.createSkinnedMesh(glbUrl, skeleton, mat).then(mesh => {
          avatar.setSkinnedMesh(mesh, skeleton);
          setupAnimations();
        }).catch(() => {
          this.meshLoader.createSkinnedMesh('./assets/avatar/avatar-idle.drc', skeleton, mat).then(mesh => {
            avatar.setSkinnedMesh(mesh, skeleton);
            setupAnimations();
          }).catch(() => {
            this._fallbackRemoteMesh(avatar, skeleton, color);
            setupAnimations();
          });
        });
      } else {
        this._fallbackRemoteMesh(avatar, skeleton, color);
        setupAnimations();
      }
    } else {
      this._fallbackRemoteMesh(avatar, skeleton || null, color);
    }

    if (this.onPlayerJoined) this.onPlayerJoined({ id, displayName: data.tag || 'Player' });
  }

  _fallbackRemoteMesh(avatar, skeleton, color) {
    const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color, skinning: true });
    const mesh = new THREE.SkinnedMesh(geo, mat, skeleton);
    if (skeleton) mesh.bind(skeleton);
    avatar.setSkinnedMesh(mesh, skeleton);
  }

  _removeClient(id) {
    const avatar = this.players.get(id);
    if (avatar) {
      this.scene.remove(avatar.group);
      avatar.group.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.players.delete(id);
    }
    if (this.onPlayerLeft) this.onPlayerLeft(id);
  }

  _sendSignal(to, data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'signal', payload: { to, data } }));
    }
  }

  _startSync() {
    this._updateInterval = setInterval(() => {
      if (!this.connected) return;
      this._relay(false);
    }, SYNC_INTERVAL);
  }

  _setupAwayDetection() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._data.animation = 1;
        this._relay(true);
        if (this.onNotification) this.onNotification('Away');
      } else {
        this._data.animation = 0;
        this._relay(true);
        if (this.onNotification) this.onNotification('Back');
      }
    });
  }

  setLocalState(position, quaternion, animation) {
    this._data.p = [position.x, position.y, position.z];
    this._data.r = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
    this._data.animation = animation === 'wave' ? 1 : animation === 'stretch' ? 2 : animation === 'look' ? 3 : 0;
    this._relay(false);
  }

  sendChat(text) {
    this._sendJson({ data: { sender: this.localID || 'local', text, timestamp: Date.now() } });
  }

  sendEmote(type) {
    this._data.networkEvent = type;
    this._relay(true);
    setTimeout(() => {
      this._data.networkEvent = '';
      this._relay(true);
    }, 4000);
  }

  update(delta) {
    const now = Date.now();
    for (const [id, avatar] of this.players) {
      if (now - (avatar.lastSeenAt || 0) > 3000) {
        this._removeClient(id);
        continue;
      }
      avatar.update(delta);
    }
  }

  get playerCount() { return this.players.size; }

  disconnect() {
    if (this._updateInterval) clearInterval(this._updateInterval);
    if (this._pingInterval) clearInterval(this._pingInterval);
    if (this._relayInterval) clearInterval(this._relayInterval);
    if (this._retryInterval) clearInterval(this._retryInterval);
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close();
    for (const avatar of this.players.values()) {
      this.scene.remove(avatar.group);
    }
    this.players.clear();
    this.connected = false;
  }

  _log(...args) {
    if (import.meta.env?.DEV) console.log('[Multiplayer]', ...args);
  }
}
