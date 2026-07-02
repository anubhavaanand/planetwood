import { PlayerAvatar } from '../entities/PlayerAvatar.js';

const RECONNECT_DELAY = 5000;
const SYNC_INTERVAL = 1000 / 12;
const DISCONNECT_TIMEOUT = 10000;
const AWAY_TIMEOUT = 30000;

import * as THREE from 'three';

export class MultiplayerSystem {
  constructor(url, scene, animSys, animData, meshLoader) {
    this.url = url;
    this.scene = scene;
    this.animSys = animSys;
    this.animData = animData;
    this.meshLoader = meshLoader;
    this.connected = false;
    this.assignedId = null;
    this.displayName = '';
    this.players = new Map();
    this.pcs = new Map();
    this.syncInterval = null;
    this.awayTimer = null;
    this.away = false;
    this.localPosition = new Float32Array(3);
    this.localRotation = new Float32Array(4);
    this.localAnimation = 'idle';
    this.onNotification = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onAwayStateChanged = null;
    this.onPlayerAwayChanged = null;
    this.onEmote = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'join' }));
    };

    this.ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      this._handleMessage(msg);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._log('Connection closed');
      if (this.onNotification) this.onNotification('Multiplayer disconnected');
    };

    this.ws.onerror = () => {
      this._log('WebSocket error');
      if (this.onNotification) this.onNotification('Multiplayer unavailable — exploring alone');
    };
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'joined': {
        this.connected = true;
        this.assignedId = msg.payload.assignedId;
        this.displayName = msg.payload.displayName || this.displayName;
        this._log(`Joined session ${msg.payload.sessionId} as ${this.displayName}`);
        for (const peer of msg.payload.peers || []) {
          this._addRemotePlayer(peer);
        }
        this._startSync();
        this._setupAwayDetection();
        break;
      }
      case 'peer_joined': {
        this._addRemotePlayer(msg.payload);
        break;
      }
      case 'peer_left': {
        this._removeRemotePlayer(msg.payload.id);
        break;
      }
      case 'signal': {
        this._handleSignal(msg.payload);
        break;
      }
      case 'error': {
        this._log(`Server error: ${msg.payload.message}`);
        break;
      }
    }
  }

  _addRemotePlayer(data) {
    if (this.players.has(data.id)) return;
    const avatar = new PlayerAvatar({
      id: data.id,
      displayName: data.displayName,
      position: new THREE.Vector3().fromArray(data.position || [0, 2, 0]),
    });

    // Generate unique color tint based on display name
    let hash = 0;
    const name = data.displayName || '';
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const color = new THREE.Color().setHSL(hue / 360, 0.75, 0.55);

    const skinEntry = this.animSys.findAvatarBones(this.animData);
    if (skinEntry && !avatar.skeleton) {
      const { bones, skeleton } = this.animSys.createSkin(skinEntry);
      const mat = new THREE.MeshStandardMaterial({ color: color, skinning: true, roughness: 0.6, metalness: 0.1 });
      
      const setupAnimations = () => {
        const animNames = ['idle', 'walk', 'run', 'afk1', 'afk2', 'afk3'];
        for (const name of animNames) {
          const entry = this.animSys.findAvatarAnim(this.animData, name);
          if (entry && avatar.skeleton) {
            const { clip, mixer } = this.animSys.createSkinAnimation(entry, avatar.skeleton);
            let animName = name;
            if (name === 'afk1') animName = 'wave';
            if (name === 'afk2') animName = 'stretch';
            if (name === 'afk3') animName = 'look';
            avatar.addAnimation(animName, clip, mixer);
          }
        }
        avatar.playAnimation('idle');
      };

      if (this.meshLoader) {
        this.meshLoader.createSkinnedMesh('/assets/avatar/avatar-idle.drc', skeleton, mat).then(mesh => {
          avatar.setSkinnedMesh(mesh, skeleton);
          setupAnimations();
        }).catch(() => {
          this._fallbackRemoteMesh(avatar, skeleton, color);
          setupAnimations();
        });
      } else {
        this._fallbackRemoteMesh(avatar, skeleton, color);
        setupAnimations();
      }
    }

    this.scene.add(avatar.group);
    this.players.set(data.id, avatar);
    this._log(`Peer joined: ${data.displayName}`);
    if (this.onPlayerJoined) this.onPlayerJoined(data);
  }

  _fallbackRemoteMesh(avatar, skeleton, color) {
    const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: color, skinning: true });
    const mesh = new THREE.SkinnedMesh(geo, mat, skeleton);
    mesh.bind(skeleton);
    avatar.setSkinnedMesh(mesh, skeleton);
  }

  _removeRemotePlayer(id) {
    const avatar = this.players.get(id);
    if (!avatar) return;
    this.scene.remove(avatar.group);
    
    // Clear timeout and dispose geometry/materials to prevent memory leaks
    if (avatar.emoteTimeout) clearTimeout(avatar.emoteTimeout);
    avatar.group.traverse((child) => {
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
    this._log(`Peer left: ${avatar.displayName}`);
    if (this.onPlayerLeft) this.onPlayerLeft(id);
  }

  _handleSignal(payload) {
    const { from, data } = payload;
    if (!this.pcs.has(from)) {
      this._createPeerConnection(from);
    }
    const pc = this.pcs.get(from);
    if (data.type === 'offer') {
      pc.setRemoteDescription(new RTCSessionDescription(data));
      pc.createAnswer().then((answer) => {
        pc.setLocalDescription(answer);
        this._sendSignal(from, answer);
      });
    } else if (data.type === 'answer') {
      pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(data));
    }
  }

  _createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pcs.set(peerId, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendSignal(peerId, e.candidate);
      }
    };

    pc.ondatachannel = (e) => {
      this._setupDataChannel(e.channel, peerId);
    };

    const dc = pc.createDataChannel('state');
    this._setupDataChannel(dc, peerId);

    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer);
      this._sendSignal(peerId, offer);
    });
  }

  _setupDataChannel(dc, peerId) {
    dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this._handleDataMessage(msg, peerId);
    };
    dc.onopen = () => this._log(`DataChannel open with ${peerId}`);
    dc.onclose = () => this._log(`DataChannel closed with ${peerId}`);
  }

  _handleDataMessage(msg, peerId) {
    const avatar = this.players.get(peerId);
    if (!avatar) return;
    switch (msg.type) {
      case 'state': {
        avatar.group.position.fromArray(msg.position);
        if (msg.rotation) avatar.group.quaternion.fromArray(msg.rotation);
        
        const nextAnim = msg.animation || 'idle';
        if (avatar.animationState !== nextAnim) {
          avatar.playAnimation(nextAnim);
        }

        if (avatar.away !== msg.away) {
          avatar.away = msg.away;
          if (this.onPlayerAwayChanged) {
            this.onPlayerAwayChanged(peerId, msg.away);
          }
        }
        
        avatar.lastSeenAt = Date.now();
        break;
      }
      case 'chat': {
        if (this.onChatMessage) {
          this.onChatMessage({ senderId: peerId, senderName: avatar.displayName, text: msg.text, timestamp: msg.timestamp });
        }
        break;
      }
      case 'emote': {
        if (this.onEmote) this.onEmote(peerId, msg.emote);
        break;
      }
    }
  }

  _sendSignal(to, data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'signal', payload: { to, data } }));
    }
  }

  _startSync() {
    this.syncInterval = setInterval(() => {
      if (!this.connected) return;
      for (const [peerId, pc] of this.pcs) {
        if (pc.connectionState !== 'connected') continue;
        const dc = pc.dataChannels?.[0] || pc.createDataChannel('state');
        if (dc.readyState === 'open') {
          dc.send(JSON.stringify({
            type: 'state',
            position: Array.from(this.localPosition),
            rotation: Array.from(this.localRotation),
            animation: this.localAnimation,
            away: this.away,
          }));
        }
      }
    }, SYNC_INTERVAL);
  }

  _setupAwayDetection() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.awayTimer = setTimeout(() => {
          this.away = true;
          this.localAnimation = 'afk1';
          this._broadcastState();
          this._log('Away');
          if (this.onAwayStateChanged) this.onAwayStateChanged(true);
        }, AWAY_TIMEOUT);
      } else {
        if (this.awayTimer) {
          clearTimeout(this.awayTimer);
          this.awayTimer = null;
        }
        if (this.away) {
          this.away = false;
          this.localAnimation = 'idle';
          this._broadcastState();
          this._log('Back');
          if (this.onAwayStateChanged) this.onAwayStateChanged(false);
        }
      }
    });
  }

  _broadcastState() {
    for (const [peerId, pc] of this.pcs) {
      if (pc.connectionState !== 'connected') continue;
      const dc = pc.dataChannels?.[0];
      if (dc?.readyState === 'open') {
        dc.send(JSON.stringify({
          type: 'state',
          position: Array.from(this.localPosition),
          rotation: Array.from(this.localRotation),
          animation: this.localAnimation,
          away: this.away,
        }));
      }
    }
  }

  setLocalState(position, quaternion, animation) {
    this.localPosition = [position.x, position.y, position.z];
    this.localRotation = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
    this.localAnimation = animation || 'idle';
  }

  sendChat(text) {
    for (const [peerId, pc] of this.pcs) {
      if (pc.connectionState !== 'connected') continue;
      const dc = pc.dataChannels?.[0];
      if (dc?.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'chat', text, timestamp: Date.now() }));
      }
    }
  }

  sendEmote(type) {
    for (const [peerId, pc] of this.pcs) {
      if (pc.connectionState !== 'connected') continue;
      const dc = pc.dataChannels?.[0];
      if (dc?.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'emote', emote: type }));
      }
    }
  }

  update(delta) {
    const now = Date.now();
    for (const [id, avatar] of this.players) {
      if (now - avatar.lastSeenAt > DISCONNECT_TIMEOUT) {
        this._removeRemotePlayer(id);
        continue;
      }
      avatar.update(delta);
    }
  }

  get playerCount() { return this.players.size; }

  disconnect() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.ws) this.ws.close();
    for (const pc of this.pcs.values()) pc.close();
    this.pcs.clear();
    for (const avatar of this.players.values()) this.scene.remove(avatar.group);
    this.players.clear();
    this.connected = false;
  }

  _log(...args) {
    if (import.meta.env?.DEV) {
      console.log('[Multiplayer]', ...args);
    }
  }
}
