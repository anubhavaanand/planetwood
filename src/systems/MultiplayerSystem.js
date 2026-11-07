import * as protobuf from 'protobufjs';
import * as THREE from 'three';
import { PlayerAvatar } from '../entities/PlayerAvatar.js';
import { debugWarn } from '../utils/debug.js';

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
    // Client id from the previous session, used to restore last-known position on rejoin.
    this.rejoinId = localStorage.getItem('planetwood_client_id') || '';

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
    // WebRTC P2P
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.pendingCandidates = new Map();
    this.p2pEstablished = new Set();
    this.p2pFallbackTimers = new Map();
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];
    this._pcConfig = { iceServers: this.iceServers };
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
    // Fired when the server restores a last-known position on rejoin: { p, r }.
    this.onRestoredPosition = null;

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
        // The join request must use the id from the previous session (loaded
        // from localStorage at construction) so the server can look up the
        // last-known position. Capture it before overwriting with the new id.
        const rejoinIdForJoin = this.rejoinId;
        // Persist this connection's id so the next reconnection can request a position restore.
        localStorage.setItem('planetwood_client_id', json.id);
        this.rejoinId = json.id;
        this._requestRoom(this.roomRequested, rejoinIdForJoin);
      } else if (json.r && typeof json.r === 'string') {
        this.clients.clear();
        this.roomRequested = json.r;
        clearInterval(this._pingInterval);
        this._pingInterval = setInterval(this._boundPing, this._pingRate * 1000);
        clearInterval(this._relayInterval);
        this._relayInterval = setInterval(this._boundRelay, this._updateRate);
        this._ping();
        this._relay(true);
        // Apply restored position/rotation if the server sent one back.
        // Update local synced state so the first state broadcast uses the
        // restored position instead of the default start position.
        if (json.restorePos || json.restoreRot) {
          if (json.restorePos && Array.isArray(json.restorePos) && json.restorePos.length === 3) {
            this._data.p = [...json.restorePos];
          }
          if (json.restoreRot && Array.isArray(json.restoreRot) && json.restoreRot.length === 4) {
            this._data.r = [...json.restoreRot];
          }
          if (this.onRestoredPosition) {
            this.onRestoredPosition({ p: json.restorePos, r: json.restoreRot });
          }
        }
        this._onRoomJoined(this.roomRequested);
      } else if (json.data) {
        if (this.onChatMessage) this.onChatMessage(json.data);
      } else if (json.leave && typeof json.leave === 'string') {
        if (!this.clients.has(json.leave)) return;
        this.clients.delete(json.leave);
        this._removeClient(json.leave);
      } else if (json.type === 'signal') {
        // WebRTC signaling relayed through WebSocket
        const { from, data } = json.payload || {};
        if (from && data) {
          this._handleSignaling(from, data);
        }
      } else if (json.type === 'peer_joined') {
        // Remote peer joined — initiate P2P connection
        const { id } = json.payload || {};
        if (id && id !== this.localID) {
          this._createPeerConnection(id, true);
        }
      } else if (json.type === 'peer_left') {
        const { id } = json.payload || {};
        if (id) this._closePeerConnection(id);
      }
    } catch {}
  }

  _onRoomJoined(room) {
    if (this.onNotification) this.onNotification(`Joined room: ${room}`);
  }

  _ping() {
    this._sendJson({ ping: Date.now() });
  }

  _requestRoom(room = '', rejoinId = this.rejoinId) {
    this.roomRequested = room;
    this._sendJson({ r: [this.roomPrefix, this.roomRequested], rejoinId });
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
      this._sendP2POrRelay(JSON.parse(this._prevData));
    } else {
      const changed = this._retrieveChangedData();
      if (Object.keys(changed).length === 0) return;
      this._prevData = JSON.stringify(this._data);
      this._sendP2POrRelay(changed);
    }
  }

  // Send via P2P data channels to peers that have them open,
  // falling back to WebSocket relay for peers without P2P.
  _sendP2POrRelay(obj) {
    let sentP2P = false;
    const bytes = this._encodeRelayData(obj);
    if (bytes) {
      for (const [peerId, dc] of this.dataChannels) {
        if (dc.readyState === 'open') {
          dc.send(bytes);
          sentP2P = true;
        }
      }
    }

    // WebSocket relay as fallback for peers without an open P2P channel,
    // or when P2P is not yet established.
    if (!sentP2P || this.dataChannels.size === 0) {
      this._sendRelayedData(obj);
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
      debugWarn('websocket data error', verification);
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

  // =========================================================================
  // WebRTC P2P Data Channel support
  // =========================================================================

  _createPeerConnection(peerId, isInitiator) {
    if (this.peerConnections.has(peerId)) return;

    const pc = new RTCPeerConnection(this._pcConfig);

    this.peerConnections.set(peerId, pc);

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      this.dataChannels.set(peerId, dc);
      this._setupDataChannel(peerId, dc);
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('state', { ordered: true });
      this.dataChannels.set(peerId, dc);
      this._setupDataChannel(peerId, dc);

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => this._sendSignal(peerId, {
          type: 'offer',
          sdp: pc.localDescription,
        }))
        .catch(err => this._log(`createOffer error for ${peerId}`, err));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignal(peerId, { type: 'candidate', candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this._fallbackToRelay(peerId);
        this._log(`P2P connection ${peerId} state: ${pc.connectionState}`);
      }
    };

    pc.ontrack = () => {}; // reserved — no media tracks used
  }

  _setupDataChannel(peerId, dc) {
    dc.onopen = () => {
      this.p2pEstablished.add(peerId);
      this.p2pFallbackTimers.delete(peerId);
      this._log(`P2P established with ${peerId}`);
      // Force a full state sync once P2P is up
      this._relay(true);
    };

    dc.onerror = (e) => {
      this._log(`P2P error with ${peerId}`, e);
    };

    dc.onclose = () => {
      this.p2pEstablished.delete(peerId);
      this._fallbackToRelay(peerId);
    };

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON signaling/chat over data channel
        try {
          const msg = JSON.parse(event.data);
          this._handleDataChannelMessage(peerId, msg);
        } catch {}
        return;
      }
      // Binary protobuf state sync: [localID bytes][RealmData bytes]
      try {
        const decoder = new TextDecoder();
        const localIdStr = decoder.decode(event.data.slice(0, this.localIDLength));
        const msg = RealmData.decode(new Uint8Array(event.data.slice(this.localIDLength)));
        const keys = Object.keys(msg);
        const client = this.clients.get(localIdStr);
        if (client) {
          client.lastSeenAt = Date.now();
          keys.forEach(k => {
            if (msg[k] instanceof Array && msg[k].length === 0) return;
            client[k] = msg[k];
          });
        }
      } catch {}
    };
  }

  _handleSignaling(peerId, data) {
    let pc = this.peerConnections.get(peerId);
    if (!pc) {
      // Peer initiated connection — accept it
      this._createPeerConnection(peerId, false);
      pc = this.peerConnections.get(peerId);
      if (!pc) return;
    }

    if (data.type === 'offer') {
      pc.setRemoteDescription(new RTCSessionDescription(data))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => this._sendSignal(peerId, {
          type: 'answer',
          sdp: pc.localDescription,
        }))
        .catch(err => this._log(`handle offer error for ${peerId}`, err));
    } else if (data.type === 'answer') {
      pc.setRemoteDescription(new RTCSessionDescription(data))
        .catch(err => this._log(`handle answer error for ${peerId}`, err));
    } else if (data.type === 'candidate') {
      pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        .catch(err => this._log(`addIceCandidate error for ${peerId}`, err));
    }
  }

  _sendSignal(peerId, data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'signal', payload: { to: peerId, data } }));
    }
  }

  _fallbackToRelay(peerId) {
    if (this.p2pFallbackTimers.has(peerId)) return;
    this.p2pFallbackTimers.set(peerId, setTimeout(() => {
      this.p2pFallbackTimers.delete(peerId);
      // Mark peer as relay-only; state sync will go through WebSocket relay
      this._log(`Falling back to WebSocket relay for ${peerId}`);
    }, 1000));
  }

  _closePeerConnection(peerId) {
    this.p2pEstablished.delete(peerId);
    const timer = this.p2pFallbackTimers.get(peerId);
    if (timer) clearTimeout(timer);
    this.p2pFallbackTimers.delete(peerId);
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(peerId);
    }
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
  }

  _handleDataChannelMessage(peerId, msg) {
    if (msg.type === 'state') {
      const client = this.clients.get(peerId);
      if (client) {
        client.lastSeenAt = Date.now();
        if (msg.p) client.p = msg.p;
        if (msg.r) client.r = msg.r;
        if (msg.animation !== undefined) client.animation = msg.animation;
        if (msg.medium !== undefined) client.medium = msg.medium;
        if (msg.tag !== undefined) client.tag = msg.tag;
        if (msg.networkEvent !== undefined) client.networkEvent = msg.networkEvent;
      }
    } else if (msg.type === 'chat') {
      if (this.onChatMessage) {
        this.onChatMessage({
          senderId: peerId,
          senderName: this.clients.get(peerId)?.tag || 'Player',
          text: msg.text || '',
          timestamp: msg.timestamp || Date.now(),
        });
      }
    } else if (msg.type === 'emote') {
      if (this.onEmote) this.onEmote(peerId, msg.emote);
    }
  }

  // Send state via P2P data channel if available, else WebSocket relay
  _encodeRelayData(obj) {
    try {
      const verification = RealmData.verify(obj);
      if (verification) return null;
      const msg = RealmData.create(obj);
      const bytes = RealmData.encode(msg).finish();
      const prefix = this.localID ? new TextEncoder().encode(this.localID) : new Uint8Array(0);
      const combined = new Uint8Array(prefix.length + bytes.length);
      combined.set(prefix, 0);
      combined.set(bytes, prefix.length);
      return combined;
    } catch {
      return null;
    }
  }

  _addClient(id, data) {
    if (this.players.has(id)) return;

    // Initiate P2P connection to the newly discovered peer
    this._createPeerConnection(id, true);

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
      const { bones, skeleton } = this.animSys.createSkin(skinEntry, 'avatar');
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

    // Close P2P connection to the departed peer
    this._closePeerConnection(id);
  }

  disconnect() {
    if (this._updateInterval) clearInterval(this._updateInterval);
    if (this._pingInterval) clearInterval(this._pingInterval);
    if (this._relayInterval) clearInterval(this._relayInterval);
    if (this._retryInterval) clearInterval(this._retryInterval);
    // Close all P2P connections
    for (const peerId of this.peerConnections.keys()) {
      this._closePeerConnection(peerId);
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close();
    for (const avatar of this.players.values()) {
      this.scene.remove(avatar.group);
    }
    this.players.clear();
    this.connected = false;
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
    // Close all P2P connections
    for (const peerId of this.peerConnections.keys()) {
      this._closePeerConnection(peerId);
    }
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
